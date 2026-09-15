import { useCallback, useEffect, useRef, useState } from 'react'
import { reissueOnce, toErrorInfo, tokenStore } from '@/shared/api'
import { connectStomp, WS_URL } from '@/shared/ws'
import type { StompConnection } from '@/shared/ws'
import {
  useJoinLotteryRoomMutation,
  useLazyLotteryRoomQuery,
  useLeaveLotteryRoomMutation,
  useResetLotteryMutation,
  useSaveLotterySettingsMutation,
  useStartLotteryMutation,
} from '../api/lotteryApi'
import type { LotteryRoomSnapshot, LotterySettings } from '../api/types'

export interface LotteryRoomState {
  room: LotteryRoomSnapshot | null
  connecting: boolean
  disconnected: boolean
  error: string | null
  serverOffsetMs: number
  busy: boolean
  saveSettings: (settings: LotterySettings) => Promise<boolean>
  start: (settings?: LotterySettings) => Promise<boolean>
  reset: () => Promise<boolean>
  leave: () => Promise<boolean>
  reconnect: () => void
}

export const useLotteryRoom = (roomId: string): LotteryRoomState => {
  const [room, setRoom] = useState<LotteryRoomSnapshot | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [disconnected, setDisconnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverOffsetMs, setServerOffsetMs] = useState(0)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const latest = useRef<LotteryRoomSnapshot | null>(null)
  const connectionRef = useRef<StompConnection | null>(null)
  const connectedRef = useRef(false)
  const generation = useRef(0)
  const busyRef = useRef(false)
  const [joinRoom] = useJoinLotteryRoomMutation()
  const [getRoom] = useLazyLotteryRoomQuery()
  const [leaveRoom] = useLeaveLotteryRoomMutation()
  const [save] = useSaveLotterySettingsMutation()
  const [startDraw] = useStartLotteryMutation()
  const [resetDraw] = useResetLotteryMutation()

  const accept = useCallback((snapshot: LotteryRoomSnapshot) => {
    if (snapshot.id !== roomId) return
    if (latest.current?.id === snapshot.id && latest.current.version >= snapshot.version) return
    latest.current = snapshot
    setRoom(snapshot)
    const serverTime = Date.parse(snapshot.serverTime)
    if (Number.isFinite(serverTime)) setServerOffsetMs(serverTime - Date.now())
  }, [roomId])

  useEffect(() => {
    const current = ++generation.current
    let closed = false
    let failed = false
    let connection: StompConnection | null = null
    let timeout: ReturnType<typeof setTimeout> | undefined
    let verificationInterval: ReturnType<typeof setInterval> | undefined
    let verificationTimeout: ReturnType<typeof setTimeout> | undefined
    let verificationRequest: ReturnType<typeof getRoom> | null = null
    let verificationFailures = 0
    let socketReady = false
    const active = () => !closed && generation.current === current

    if (latest.current?.id !== roomId) {
      latest.current = null
      setRoom(null)
      setServerOffsetMs(0)
    }
    setConnecting(true)
    connectedRef.current = false
    setDisconnected(false)
    setError(null)
    busyRef.current = false
    setBusy(false)

    const fail = (message: string) => {
      if (!active() || failed) return
      failed = true
      connectedRef.current = false
      clearTimeout(timeout)
      clearInterval(verificationInterval)
      clearTimeout(verificationTimeout)
      verificationRequest?.abort()
      setConnecting(false)
      setDisconnected(true)
      setError(message)
      connection?.close()
      connectionRef.current = null
    }

    const verify = async () => {
      if (!active() || failed || !socketReady || verificationRequest) return
      const request = getRoom(roomId, false)
      verificationRequest = request
      verificationTimeout = setTimeout(() => {
        if (active() && !failed) fail('방 상태를 확인하지 못했습니다. 다시 연결해 주세요.')
      }, 10_000)
      try {
        const snapshot = await request.unwrap()
        if (!active() || failed) return
        verificationFailures = 0
        accept(snapshot)
      } catch (cause) {
        if (!active() || failed) return
        verificationFailures += 1
        const status = (cause as { status?: unknown })?.status
        if (status === 401 || status === 403 || status === 404 || verificationFailures >= 2) {
          fail(toErrorInfo(cause).message)
        }
      } finally {
        request.unsubscribe()
        if (verificationRequest === request) {
          clearTimeout(verificationTimeout)
          verificationRequest = null
        }
      }
    }

    const resume = () => {
      if (document.visibilityState === 'visible') void verify()
    }

    document.addEventListener('visibilitychange', resume)

    timeout = setTimeout(() => fail('연결이 지연되고 있습니다. 다시 연결해 주세요.'), 15_000)

    const open = async () => {
      try {
        const snapshot = await joinRoom(roomId).unwrap()
        if (!active() || failed) return
        accept(snapshot)
        if (!tokenStore.get()) {
          const restored = await reissueOnce()
          if (!active() || failed) return
          if (!restored || !tokenStore.get()) {
            fail('로그인 상태를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.')
            return
          }
        }
        connection = connectStomp({
          url: WS_URL,
          token: tokenStore.get() ?? '',
          onConnect: (ready) => {
            if (!active() || failed) {
              ready.close()
              return
            }
            try {
              ready.subscribe<LotteryRoomSnapshot>(`/topic/lottery/rooms/${roomId}`, (next) => {
                if (active() && !failed) accept(next)
              })
              ready.subscribe<{ code?: string; message: string }>('/user/queue/errors', (reason) => {
                if (!active() || failed) return
                if (reason.code === 'NOT_IN_LOTTERY_ROOM' || reason.code === 'LOTTERY_ROOM_NOT_FOUND') fail(reason.message)
                else setError(reason.message)
              })
              ready.publish(`/app/lottery/rooms/${roomId}/enter`)
              clearTimeout(timeout)
              connectedRef.current = true
              setConnecting(false)
              socketReady = true
              verificationInterval = setInterval(() => { void verify() }, 5000)
            } catch (cause) {
              ready.close()
              fail(toErrorInfo(cause).message)
            }
          },
          onError: (reason) => fail(reason?.message ?? '연결이 끊어졌습니다. 다시 연결해 주세요.'),
        })
        if (!active() || failed) connection.close()
        else connectionRef.current = connection
      } catch (cause) {
        fail(toErrorInfo(cause).message)
      }
    }

    void open()

    return () => {
      closed = true
      connectedRef.current = false
      clearTimeout(timeout)
      clearInterval(verificationInterval)
      clearTimeout(verificationTimeout)
      verificationRequest?.abort()
      verificationRequest?.unsubscribe()
      document.removeEventListener('visibilitychange', resume)
      generation.current += 1
      connection?.close()
      if (connectionRef.current === connection) connectionRef.current = null
    }
  }, [roomId, attempt, joinRoom, getRoom, accept])

  const perform = async (operation: () => Promise<LotteryRoomSnapshot | void | false>, leaving = false): Promise<boolean> => {
    if (busyRef.current || (!connectedRef.current && !leaving)) return false
    const current = generation.current
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      const snapshot = await operation()
      if (generation.current !== current || snapshot === false) return false
      if (snapshot) accept(snapshot)
      if (leaving) {
        connectedRef.current = false
        generation.current += 1
        connectionRef.current?.close()
        connectionRef.current = null
        busyRef.current = false
        setBusy(false)
      }
      return true
    } catch (cause) {
      if (generation.current === current) setError(toErrorInfo(cause).message)
      return false
    } finally {
      if (generation.current === current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  return {
    room: room?.id === roomId ? room : null,
    connecting,
    disconnected,
    error,
    serverOffsetMs,
    busy,
    saveSettings: (settings) => perform(() => save({ id: roomId, settings }).unwrap()),
    start: (settings) => {
      const current = generation.current
      return perform(async () => {
        if (settings) {
          const saved = await save({ id: roomId, settings }).unwrap()
          if (generation.current !== current) return false
          accept(saved)
        }
        if (generation.current !== current || !connectedRef.current) return false
        return startDraw(roomId).unwrap()
      })
    },
    reset: () => perform(() => resetDraw(roomId).unwrap()),
    leave: () => perform(() => leaveRoom(roomId).unwrap(), true),
    reconnect: () => setAttempt((value) => value + 1),
  }
}
