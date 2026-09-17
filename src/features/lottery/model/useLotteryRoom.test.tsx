import { StrictMode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LotteryRoomSnapshot } from '../api/types'
import type { StompConnection } from '@/shared/ws'

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  save: vi.fn(),
  start: vi.fn(),
  reset: vi.fn(),
  leave: vi.fn(),
  connect: vi.fn(),
  token: vi.fn(),
  reissue: vi.fn(),
  get: vi.fn(),
}))

vi.mock('../api/lotteryApi', () => ({
  useJoinLotteryRoomMutation: () => [mocks.join],
  useLazyLotteryRoomQuery: () => [mocks.get],
  useSaveLotterySettingsMutation: () => [mocks.save],
  useStartLotteryMutation: () => [mocks.start],
  useResetLotteryMutation: () => [mocks.reset],
  useLeaveLotteryRoomMutation: () => [mocks.leave],
}))

vi.mock('@/shared/ws', () => ({
  WS_URL: 'ws://localhost/api/ws',
  connectStomp: (...args: unknown[]) => mocks.connect(...args),
}))

vi.mock('@/shared/api', async (original) => ({
  ...(await original<object>()),
  tokenStore: { get: () => mocks.token() },
  reissueOnce: () => mocks.reissue(),
}))

import { useLotteryRoom } from './useLotteryRoom'

const snapshot = (version = 1): LotteryRoomSnapshot => ({
  id: 'room-one',
  title: '추첨',
  hostId: 1,
  hostName: '선도우',
  participants: ['선도우', '육이슬'],
  winnerCount: 1,
  status: 'READY',
  winners: [],
  members: [{ userId: 1, name: '선도우' }],
  version,
  serverTime: '2026-09-14T00:00:00Z',
  nextDrawAt: null,
  drawId: 0,
})

interface SocketSession {
  options: {
    onConnect: (ready: StompConnection) => void
    onError: (reason?: { code: string; message: string }) => void
  }
  handlers: Map<string, (body: unknown) => void>
  connection: StompConnection
}

let sessions: SocketSession[]
let automaticReady: boolean

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (value: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('useLotteryRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessions = []
    automaticReady = true
    mocks.token.mockReturnValue('access-token')
    mocks.reissue.mockResolvedValue(false)
    mocks.join.mockImplementation(() => ({ unwrap: () => Promise.resolve(snapshot()) }))
    mocks.get.mockImplementation(() => ({
      unwrap: () => Promise.resolve(snapshot()),
      abort: vi.fn(),
      unsubscribe: vi.fn(),
    }))
    mocks.save.mockImplementation(() => ({ unwrap: () => Promise.resolve(snapshot(2)) }))
    mocks.start.mockImplementation(() => ({ unwrap: () => Promise.resolve(snapshot(2)) }))
    mocks.reset.mockImplementation(() => ({ unwrap: () => Promise.resolve(snapshot(2)) }))
    mocks.leave.mockImplementation(() => ({ unwrap: () => Promise.resolve() }))
    mocks.connect.mockImplementation((options: SocketSession['options']) => {
      const handlers = new Map<string, (body: unknown) => void>()
      const connection: StompConnection = {
        subscribe: (destination, callback) => {
          handlers.set(destination, callback as (body: unknown) => void)
          return () => handlers.delete(destination)
        },
        publish: vi.fn((destination: string) => {
          if (automaticReady && destination.endsWith('/enter')) {
            handlers.get('/user/queue/lottery-chat')?.({ type: 'READY', roomId: 'room-one' })
          }
        }),
        close: vi.fn(),
      }
      sessions.push({ options, handlers, connection })
      options.onConnect(connection)
      return connection
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('joins before subscribing and enters with the existing access token', async () => {
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    expect(mocks.join).toHaveBeenCalledWith('room-one')
    expect(mocks.connect.mock.calls[0][0].token).toBe('access-token')
    expect(mocks.reissue).not.toHaveBeenCalled()
    expect(sessions[0].connection.publish).toHaveBeenCalledWith('/app/lottery/rooms/room-one/enter')
    expect(result.current.room?.version).toBe(1)
  })

  it('never rolls back a websocket snapshot or its clock offset with an older mutation response', async () => {
    const pending = deferred<LotteryRoomSnapshot>()
    mocks.start.mockReturnValue({ unwrap: () => pending.promise })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    let operation!: Promise<boolean>
    act(() => {
      operation = result.current.start()
    })
    act(() =>
      sessions[0].handlers.get('/topic/lottery/rooms/room-one')?.({
        ...snapshot(4),
        serverTime: '2026-09-14T00:01:00Z',
        status: 'DRAWING',
        winners: [{ name: '육이슬', drawnAt: '2026-09-14T00:01:00Z' }],
      }),
    )
    const offset = result.current.serverOffsetMs
    await act(async () => {
      pending.resolve(snapshot(2))
      await operation
    })
    expect(result.current.room?.version).toBe(4)
    expect(result.current.room?.winners[0].name).toBe('육이슬')
    expect(result.current.serverOffsetMs).toBe(offset)
  })

  it('reconnects once requested and ignores callbacks from the closed connection', async () => {
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    act(() => sessions[0].options.onError({ code: 'CLOSED', message: '연결 종료' }))
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toBe('연결 종료')
    act(() => result.current.reconnect())
    await waitFor(() => expect(sessions).toHaveLength(2))
    act(() => sessions[0].handlers.get('/topic/lottery/rooms/room-one')?.(snapshot(99)))
    expect(result.current.room?.version).toBe(1)
    expect(result.current.disconnected).toBe(false)
    expect(sessions[0].connection.close).toHaveBeenCalled()
  })

  it('shows REST join failures and can retry them', async () => {
    mocks.join.mockImplementationOnce(() => ({
      unwrap: () => Promise.reject({ status: 403, data: { message: '입장 불가' } }),
    }))
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.disconnected).toBe(true))
    expect(result.current.error).toBe('입장 불가')
    expect(mocks.connect).not.toHaveBeenCalled()
    act(() => result.current.reconnect())
    await waitFor(() => expect(result.current.connecting).toBe(false))
    expect(result.current.disconnected).toBe(false)
  })

  it('keeps the last room and displays command failures', async () => {
    mocks.save.mockReturnValue({
      unwrap: () =>
        Promise.reject({ status: 403, data: { message: '방장만 변경할 수 있습니다.' } }),
    })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    await act(async () =>
      expect(await result.current.saveSettings({ participants: ['김성호'], winnerCount: 1 })).toBe(
        false,
      ),
    )
    expect(result.current.room?.participants).toEqual(['선도우', '육이슬'])
    expect(result.current.error).toBe('방장만 변경할 수 있습니다.')
    expect(result.current.busy).toBe(false)
  })

  it('keeps saving and starting under one busy lock across settings updates', async () => {
    const saved = deferred<LotteryRoomSnapshot>()
    const started = deferred<LotteryRoomSnapshot>()
    const settings = { participants: ['선도우', '김성호'], winnerCount: 2 }
    mocks.save.mockReturnValue({ unwrap: () => saved.promise })
    mocks.start.mockReturnValue({ unwrap: () => started.promise })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))

    let operation!: Promise<boolean>
    act(() => {
      operation = result.current.start(settings)
    })
    expect(result.current.busy).toBe(true)
    expect(mocks.save).toHaveBeenCalledWith({ id: 'room-one', settings })
    expect(mocks.start).not.toHaveBeenCalled()
    await act(async () => {
      expect(await result.current.start(settings)).toBe(false)
      expect(await result.current.leave()).toBe(false)
    })
    expect(mocks.leave).not.toHaveBeenCalled()

    await act(async () => saved.resolve({ ...snapshot(2), ...settings }))
    expect(result.current.room?.participants).toEqual(settings.participants)
    expect(result.current.room?.winnerCount).toBe(2)
    expect(result.current.busy).toBe(true)
    expect(mocks.start).toHaveBeenCalledOnce()
    await act(async () => {
      expect(await result.current.start()).toBe(false)
      expect(await result.current.saveSettings(settings)).toBe(false)
    })
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(mocks.start).toHaveBeenCalledOnce()

    await act(async () => {
      started.resolve({ ...snapshot(3), ...settings, status: 'DRAWING', drawId: 1 })
      expect(await operation).toBe(true)
    })
    expect(result.current.room?.status).toBe('DRAWING')
    expect(result.current.busy).toBe(false)
  })

  it('does not start when saving the draft fails', async () => {
    mocks.save.mockReturnValue({
      unwrap: () => Promise.reject({ status: 400, data: { message: '같은 이름이 있습니다.' } }),
    })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    await act(async () => {
      expect(
        await result.current.start({ participants: ['선도우', '김성호'], winnerCount: 1 }),
      ).toBe(false)
    })
    expect(mocks.start).not.toHaveBeenCalled()
    expect(result.current.room?.version).toBe(1)
    expect(result.current.error).toBe('같은 이름이 있습니다.')
    expect(result.current.busy).toBe(false)
  })

  it('does not start after the socket disconnects while saving and retains the connection error', async () => {
    const pending = deferred<LotteryRoomSnapshot>()
    const settings = { participants: ['선도우', '김성호'], winnerCount: 1 }
    mocks.save.mockReturnValue({ unwrap: () => pending.promise })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    const previousStart = result.current.start
    let operation!: Promise<boolean>
    act(() => {
      operation = previousStart(settings)
    })
    act(() => sessions[0].options.onError({ code: 'CLOSED', message: '연결이 끊겼습니다.' }))
    await act(async () => {
      pending.resolve({ ...snapshot(2), ...settings })
      expect(await operation).toBe(false)
    })
    expect(result.current.room?.participants).toEqual(settings.participants)
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toBe('연결이 끊겼습니다.')
    expect(result.current.busy).toBe(false)
    await act(async () => expect(await previousStart()).toBe(false))
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('does not start after leaving the screen while saving', async () => {
    const pending = deferred<LotteryRoomSnapshot>()
    mocks.save.mockReturnValue({ unwrap: () => pending.promise })
    const { result, unmount } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    let operation!: Promise<boolean>
    act(() => {
      operation = result.current.start({ participants: ['김성호'], winnerCount: 1 })
    })
    unmount()
    await act(async () => {
      pending.resolve({ ...snapshot(2), participants: ['김성호'] })
      expect(await operation).toBe(false)
    })
    expect(mocks.start).not.toHaveBeenCalled()
    expect(sessions[0].connection.close).toHaveBeenCalledOnce()
  })

  it('does not let an abandoned save start or release a new connection operation', async () => {
    const saved = deferred<LotteryRoomSnapshot>()
    const started = deferred<LotteryRoomSnapshot>()
    mocks.save.mockReturnValue({ unwrap: () => saved.promise })
    mocks.start.mockReturnValue({ unwrap: () => started.promise })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    let abandoned!: Promise<boolean>
    act(() => {
      abandoned = result.current.start({ participants: ['김성호'], winnerCount: 1 })
    })
    act(() => sessions[0].options.onError({ code: 'CLOSED', message: '연결 종료' }))
    act(() => result.current.reconnect())
    await waitFor(() => expect(sessions).toHaveLength(2))
    let current!: Promise<boolean>
    act(() => {
      current = result.current.start()
    })
    await act(async () => {
      saved.resolve({ ...snapshot(2), participants: ['김성호'] })
      expect(await abandoned).toBe(false)
    })
    expect(mocks.start).toHaveBeenCalledOnce()
    expect(result.current.busy).toBe(true)
    expect(result.current.room?.participants).toEqual(snapshot().participants)
    await act(async () => {
      started.resolve({ ...snapshot(3), status: 'DRAWING' })
      expect(await current).toBe(true)
    })
    expect(result.current.busy).toBe(false)
  })

  it('starts an unchanged draft without saving settings', async () => {
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    await act(async () => expect(await result.current.start()).toBe(true))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.start).toHaveBeenCalledWith('room-one')
  })

  it('does not connect with an empty token after failed refresh', async () => {
    mocks.token.mockReturnValue(null)
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.disconnected).toBe(true))
    expect(mocks.reissue).toHaveBeenCalledOnce()
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('exposes a retry when joining hangs and ignores its late result', async () => {
    vi.useFakeTimers()
    try {
      const pending = deferred<LotteryRoomSnapshot>()
      mocks.join.mockReturnValue({ unwrap: () => pending.promise })
      const { result, unmount } = renderHook(() => useLotteryRoom('room-one'))
      await act(async () => vi.advanceTimersByTimeAsync(15_000))
      expect(result.current.connecting).toBe(false)
      expect(result.current.disconnected).toBe(true)
      await act(async () => pending.resolve(snapshot()))
      expect(mocks.connect).not.toHaveBeenCalled()
      expect(result.current.room).toBeNull()
      unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores an abandoned StrictMode join and closes the active socket on unmount', async () => {
    const first = deferred<LotteryRoomSnapshot>()
    mocks.join.mockImplementationOnce(() => ({ unwrap: () => first.promise }))
    const { result, unmount } = renderHook(() => useLotteryRoom('room-one'), {
      wrapper: StrictMode,
    })
    await waitFor(() => expect(result.current.connecting).toBe(false))
    await act(async () => first.resolve(snapshot(99)))
    expect(sessions).toHaveLength(1)
    expect(result.current.room?.version).toBe(1)
    unmount()
    expect(sessions[0].connection.close).toHaveBeenCalledOnce()
  })

  it.each([401, 403, 404])(
    'detects revoked membership or a missing room through periodic GET (%s)',
    async (status) => {
      vi.useFakeTimers()
      mocks.get.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({ status, data: { message: '더 이상 참여 중인 방이 아닙니다.' } }),
        abort: vi.fn(),
        unsubscribe: vi.fn(),
      }))
      const { result } = renderHook(() => useLotteryRoom('room-one'))
      await act(async () => {})
      expect(result.current.disconnected).toBe(false)
      await act(async () => vi.advanceTimersByTimeAsync(5000))
      expect(mocks.get).toHaveBeenCalledWith('room-one', false)
      expect(result.current.disconnected).toBe(true)
      expect(result.current.error).toBe('더 이상 참여 중인 방이 아닙니다.')
      expect(sessions[0].connection.close).toHaveBeenCalledOnce()
      await act(async () => vi.advanceTimersByTimeAsync(10_000))
      expect(mocks.get).toHaveBeenCalledOnce()
    },
  )

  it('verifies on tab return without overlapping GETs and ignores old snapshots and clock offsets', async () => {
    vi.useFakeTimers()
    const pending = deferred<LotteryRoomSnapshot>()
    mocks.get.mockReturnValue({
      unwrap: () => pending.promise,
      abort: vi.fn(),
      unsubscribe: vi.fn(),
    })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    act(() => sessions[0].handlers.get('/topic/lottery/rooms/room-one')?.(snapshot(4)))
    const offset = result.current.serverOffsetMs
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(mocks.get).toHaveBeenCalledOnce()
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(mocks.get).toHaveBeenCalledOnce()
    await act(async () => pending.resolve({ ...snapshot(2), serverTime: '2030-01-01T00:00:00Z' }))
    expect(result.current.room?.version).toBe(4)
    expect(result.current.serverOffsetMs).toBe(offset)
    mocks.get.mockReturnValue({
      unwrap: () => Promise.resolve({ ...snapshot(4), serverTime: '2030-01-01T00:00:00Z' }),
      abort: vi.fn(),
      unsubscribe: vi.fn(),
    })
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current.serverOffsetMs).toBe(offset)
  })

  it('accepts a newer GET snapshot if a broadcast was missed', async () => {
    vi.useFakeTimers()
    mocks.get.mockReturnValue({
      unwrap: () => Promise.resolve(snapshot(3)),
      abort: vi.fn(),
      unsubscribe: vi.fn(),
    })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.current.room?.version).toBe(3)
    expect(result.current.disconnected).toBe(false)
  })

  it('allows one transient network failure and disconnects after a second failure', async () => {
    vi.useFakeTimers()
    mocks.get.mockImplementation(() => ({
      unwrap: () => Promise.reject({ status: 'FETCH_ERROR' }),
      abort: vi.fn(),
      unsubscribe: vi.fn(),
    }))
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.current.disconnected).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toContain('네트워크')
  })

  it('aborts a hung verification and exposes reconnect instead of remaining falsely connected', async () => {
    vi.useFakeTimers()
    const pending = deferred<LotteryRoomSnapshot>()
    const abort = vi.fn()
    mocks.get.mockReturnValue({ unwrap: () => pending.promise, abort, unsubscribe: vi.fn() })
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toContain('방 상태를 확인하지 못했습니다')
    expect(abort).toHaveBeenCalledOnce()
    await act(async () => pending.resolve(snapshot(99)))
    expect(result.current.room?.version).toBe(1)
  })

  it('cancels pending verification and listeners on unmount', async () => {
    vi.useFakeTimers()
    const pending = deferred<LotteryRoomSnapshot>()
    const abort = vi.fn()
    const unsubscribe = vi.fn()
    mocks.get.mockReturnValue({ unwrap: () => pending.promise, abort, unsubscribe })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { unmount } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    unmount()
    expect(abort).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
    await act(async () => pending.resolve(snapshot(99)))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(mocks.get).toHaveBeenCalledOnce()
  })

  it('treats rejected STOMP enter membership as a disconnected room', async () => {
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await waitFor(() => expect(result.current.connecting).toBe(false))
    act(() =>
      sessions[0].handlers.get('/user/queue/errors')?.({
        code: 'NOT_IN_LOTTERY_ROOM',
        message: '다시 입장해 주세요.',
      }),
    )
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toBe('다시 입장해 주세요.')
  })

  it('shares the room socket with chat without changing the room version, busy state or game errors', async () => {
    let renders = 0
    const { result } = renderHook(() => {
      renders += 1
      return useLotteryRoom('room-one')
    })
    await waitFor(() => expect(result.current.connecting).toBe(false))
    const receive = vi.fn()
    const transport = result.current.chatTransport
    transport.subscribe(receive)
    expect(transport.isConnected()).toBe(true)
    const renderCount = renders
    act(() =>
      sessions[0].handlers.get('/topic/lottery/rooms/room-one/chat')?.({
        type: 'TYPING',
        roomId: 'room-one',
        people: [],
      }),
    )
    act(() =>
      sessions[0].handlers.get('/user/queue/lottery-chat')?.({
        type: 'ERROR',
        roomId: 'room-one',
        code: 'CHAT_RATE_LIMIT',
        message: '잠시 기다려 주세요.',
      }),
    )
    expect(receive).toHaveBeenCalledTimes(2)
    expect(renders).toBe(renderCount)
    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(result.current.room?.version).toBe(1)
    expect(result.current.busy).toBe(false)
    expect(result.current.error).toBeNull()
    act(() => sessions[0].options.onError())
    expect(transport.isConnected()).toBe(false)
  })
  it('waits for chat readiness before exposing the room connection or verifying its state', async () => {
    vi.useFakeTimers()
    automaticReady = false
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    expect(sessions[0].handlers.has('/topic/lottery/rooms/room-one/chat')).toBe(true)
    expect(sessions[0].handlers.has('/user/queue/lottery-chat')).toBe(true)
    expect(sessions[0].connection.publish).toHaveBeenCalledWith('/app/lottery/rooms/room-one/enter')
    expect(result.current.connecting).toBe(true)
    expect(result.current.chatTransport.isConnected()).toBe(false)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(mocks.get).not.toHaveBeenCalled()
    act(() =>
      sessions[0].handlers.get('/user/queue/lottery-chat')?.({ type: 'READY', roomId: 'room-one' }),
    )
    expect(result.current.connecting).toBe(false)
    expect(result.current.chatTransport.isConnected()).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(mocks.get).toHaveBeenCalledOnce()
  })

  it('times out missing READY and ignores late handshake replies', async () => {
    vi.useFakeTimers()
    automaticReady = false
    const { result } = renderHook(() => useLotteryRoom('room-one'))
    await act(async () => {})
    const late = sessions[0].handlers.get('/user/queue/lottery-chat')
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(result.current.disconnected).toBe(true)
    expect(result.current.error).toContain('연결이 지연')
    expect(sessions[0].connection.close).toHaveBeenCalledOnce()
    act(() => late?.({ type: 'READY', roomId: 'room-one' }))
    expect(result.current.chatTransport.isConnected()).toBe(false)
    expect(result.current.disconnected).toBe(true)
  })
})
