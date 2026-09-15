import { useCallback, useEffect, useRef, useState } from 'react'
import { reissueOnce, sessionStore, tokenStore } from '@/shared/api'
import { connectStomp, WS_URL } from '@/shared/ws'
import type { ErrorReason, StompConnection } from '@/shared/ws'
import { useLotteryRoomsQuery } from '../api/lotteryApi'

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'authError'

const AUTH_ERRORS = new Set(['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'INVALID_TOKEN'])

export const useLotteryLobby = () => {
  const query = useLotteryRoomsQuery(undefined, { refetchOnMountOrArgChange: true })
  const { refetch, isFetching } = query
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const fetching = useRef(isFetching)
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => { fetching.current = isFetching }, [isFetching])

  useEffect(() => {
    let disposed = false
    let connection: StompConnection | null = null
    let generation = 0
    let retryCount = 0
    let connected = false
    let opening = false
    let refreshToken = false
    let refreshedToken = false
    let authFailed = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let connectTimeout: ReturnType<typeof setTimeout> | undefined
    let running: Promise<void> | null = null
    let trailing = false

    const refresh = (): Promise<void> => {
      if (disposed) return Promise.resolve()
      if (running) {
        trailing = true
        return running
      }
      trailing = fetching.current
      running = Promise.resolve().then(async () => {
        do {
          if (disposed) break
          await refetch()
          if (disposed || !trailing) break
          trailing = false
        } while (!disposed)
      }).finally(() => { running = null })
      return running
    }
    const open = async () => {
      if (disposed || opening || connected || authFailed) return
      clearTimeout(retryTimer)
      opening = true
      const current = ++generation
      const active = () => !disposed && generation === current
      setConnectionStatus(retryCount > 0 ? 'reconnecting' : 'connecting')

      const fail = (reason?: ErrorReason) => {
        if (!active()) return
        generation += 1
        connected = false
        opening = false
        clearTimeout(connectTimeout)
        connection?.close()
        connection = null
        if (reason && AUTH_ERRORS.has(reason.code)) {
          if (refreshedToken) {
            authFailed = true
            setConnectionStatus('authError')
            return
          }
          refreshToken = true
        }
        setConnectionStatus('reconnecting')
        retryTimer = setTimeout(() => { void open() }, Math.min(1000 * 2 ** Math.min(retryCount++, 5), 30_000))
      }

      connectTimeout = setTimeout(() => fail(), 15_000)
      try {
        if (refreshToken || !tokenStore.get()) {
          const restored = await reissueOnce()
          if (!active()) return
          if (!restored || !tokenStore.get()) {
            if (!sessionStore.get().ended) { fail(); return }
            clearTimeout(connectTimeout)
            opening = false
            authFailed = true
            setConnectionStatus('authError')
            return
          }
          refreshedToken = true
          refreshToken = false
        }
        const next = connectStomp({
          url: WS_URL,
          token: tokenStore.get() ?? '',
          onConnect: (ready) => {
            if (!active()) {
              ready.close()
              return
            }
            connection = ready
            try {
              ready.subscribe<{ type: string }>('/topic/lottery/lobby', (event) => {
                if (!active() || event.type !== 'ROOMS_CHANGED') return
                clearTimeout(connectTimeout)
                opening = false
                connected = true
                retryCount = 0
                refreshedToken = false
                setConnectionStatus('connected')
                void refresh()
              })
            } catch {
              fail()
            }
          },
          onError: fail,
        })
        if (active()) connection = next
        else next.close()
      } catch {
        fail()
      }
    }

    const refreshAndReconnect = () => {
      if (disposed) return Promise.resolve()
      if (authFailed) {
        authFailed = false
        refreshedToken = false
      }
      if (!connected && !opening) void open()
      return refresh()
    }
    refreshRef.current = refreshAndReconnect
    const resume = () => {
      if (document.visibilityState === 'visible') void refreshAndReconnect()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    void open()

    return () => {
      disposed = true
      generation += 1
      clearTimeout(retryTimer)
      clearTimeout(connectTimeout)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
      connection?.close()
      if (refreshRef.current === refreshAndReconnect) refreshRef.current = () => Promise.resolve()
    }
  }, [refetch])

  const refresh = useCallback(() => refreshRef.current(), [])
  return { ...query, refetch: refresh, connectionStatus }
}
