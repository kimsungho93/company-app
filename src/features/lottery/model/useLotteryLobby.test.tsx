import type { ReactNode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseApi, tokenStore } from '@/shared/api'
import type { ErrorReason, StompConnection } from '@/shared/ws'
import type { LotteryRoomSummary } from '../api/types'
import { useLotteryLobby } from './useLotteryLobby'

const mocks = vi.hoisted(() => ({ connect: vi.fn(), reissue: vi.fn(), fetch: vi.fn() }))

vi.mock('@/shared/ws', () => ({
  WS_URL: 'ws://localhost/api/ws',
  connectStomp: (...args: unknown[]) => mocks.connect(...args),
}))

vi.mock('@/shared/api', async (original) => ({
  ...(await original<object>()),
  reissueOnce: () => mocks.reissue(),
}))

interface Session {
  options: { onConnect: (ready: StompConnection) => void; onError: (reason?: ErrorReason) => void }
  handlers: Map<string, (body: unknown) => void>
  connection: StompConnection
}

const room = (id: string): LotteryRoomSummary => ({
  id, title: id, hostId: 1, hostName: '선도우', status: 'READY', memberCount: 1, participantCount: 13, winnerCount: 1,
})
const response = (rooms: LotteryRoomSummary[] = []) => new Response(JSON.stringify(rooms), { headers: { 'Content-Type': 'application/json' } })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const createStore = () => configureStore({
  reducer: { [baseApi.reducerPath]: baseApi.reducer },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

let sessions: Session[]
let stores: ReturnType<typeof createStore>[]

const setup = (strict = false) => {
  const store = createStore()
  stores.push(store)
  return renderHook(() => useLotteryLobby(), {
    reactStrictMode: strict,
    wrapper: ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>,
  })
}
const emit = (session = sessions.at(-1)!, body: unknown = { type: 'ROOMS_CHANGED' }) => {
  act(() => session.handlers.get('/topic/lottery/lobby')?.(body))
}

describe('useLotteryLobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessions = []
    stores = []
    tokenStore.set('access-token')
    mocks.reissue.mockResolvedValue(false)
    mocks.fetch.mockImplementation(() => Promise.resolve(response()))
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.connect.mockImplementation((options: Session['options']) => {
      const handlers = new Map<string, (body: unknown) => void>()
      const connection: StompConnection = {
        subscribe: (destination, callback) => {
          handlers.set(destination, callback as (body: unknown) => void)
          return () => handlers.delete(destination)
        },
        close: vi.fn(), publish: vi.fn(),
      }
      sessions.push({ options, handlers, connection })
      options.onConnect(connection)
      return connection
    })
  })

  afterEach(() => {
    cleanup()
    for (const store of stores) store.dispatch(baseApi.util.resetApiState())
    tokenStore.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads initially, subscribes with the access token, and stops periodic REST requests', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.connect.mock.calls[0][0].token).toBe('access-token')
    expect(sessions[0].handlers.has('/topic/lottery/lobby')).toBe(true)
    expect(result.current.connectionStatus).toBe('connecting')

    emit()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    expect(result.current.connectionStatus).toBe('connected')
    vi.useFakeTimers()
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('follows an invalidation during the real RTK initial request with a fresh request', async () => {
    const pending = deferred<Response>()
    mocks.fetch.mockReturnValueOnce(pending.promise).mockImplementation(() => Promise.resolve(response([room('new-room')])))
    const { result } = setup()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())

    emit()
    emit()
    emit()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(response([room('old-room')])) })

    await waitFor(() => expect(result.current.data?.[0].id).toBe('new-room'))
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('coalesces events during a pending refresh and retains a trailing update', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    emit()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    const pending = deferred<Response>()
    mocks.fetch.mockReturnValueOnce(pending.promise).mockImplementation(() => Promise.resolve(response([room('latest')])))

    emit()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(3))
    for (let index = 0; index < 10; index++) emit()
    await act(async () => { pending.resolve(response([room('stale')])) })

    await waitFor(() => expect(result.current.data?.[0].id).toBe('latest'))
    expect(mocks.fetch).toHaveBeenCalledTimes(4)
  })

  it('ignores unrelated events and resyncs when returning to the tab', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    emit(undefined, { type: 'OTHER_EVENT' })
    expect(mocks.fetch).toHaveBeenCalledOnce()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(mocks.fetch).toHaveBeenCalledOnce()

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
  })

  it('reconnects and resyncs after interruption while ignoring the old connection', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    emit()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    vi.useFakeTimers()
    const oldSession = sessions[0]
    act(() => oldSession.options.onError())
    expect(result.current.connectionStatus).toBe('reconnecting')
    expect(oldSession.connection.close).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(sessions).toHaveLength(2)
    expect(result.current.connectionStatus).toBe('reconnecting')

    emit(oldSession)
    act(() => oldSession.options.onError())
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    emit()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(mocks.fetch).toHaveBeenCalledTimes(3)
    expect(result.current.connectionStatus).toBe('connected')
  })

  it('keeps bounded exponential backoff until the subscription is accepted', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    vi.useFakeTimers()
    for (const delay of [1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]) {
      const count = sessions.length
      act(() => sessions.at(-1)!.options.onError())
      await act(async () => { await vi.advanceTimersByTimeAsync(delay - 1) })
      expect(sessions).toHaveLength(count)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(sessions).toHaveLength(count + 1)
      expect(result.current.connectionStatus).toBe('reconnecting')
    }
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it('times out a connection that never receives subscription confirmation', async () => {
    vi.useFakeTimers()
    const { result } = setup()
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(result.current.connectionStatus).toBe('reconnecting')
    expect(sessions[0].connection.close).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(sessions).toHaveLength(2)
  })

  it('refreshes an expired token once before reconnecting', async () => {
    mocks.reissue.mockImplementation(async () => { tokenStore.set('renewed-token'); return true })
    const { result } = setup()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    vi.useFakeTimers()
    act(() => sessions[0].options.onError({ code: 'TOKEN_EXPIRED', message: '인증 만료' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(mocks.reissue).toHaveBeenCalledOnce()
    expect(mocks.connect.mock.calls[1][0].token).toBe('renewed-token')
    act(() => sessions[1].options.onError({ code: 'UNAUTHENTICATED', message: '인증 실패' }))
    expect(result.current.connectionStatus).toBe('authError')
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(sessions).toHaveLength(2)
    expect(mocks.reissue).toHaveBeenCalledOnce()
  })

  it.each(['manual', 'online', 'visibility'] as const)('recovers a failed token restore through %s refresh', async (trigger) => {
    tokenStore.clear()
    const { result } = setup()
    await waitFor(() => expect(result.current.connectionStatus).toBe('authError'))
    expect(mocks.connect).not.toHaveBeenCalled()
    expect(mocks.reissue).toHaveBeenCalledOnce()
    tokenStore.set('restored-token')

    await act(async () => {
      if (trigger === 'manual') await result.current.refetch()
      else if (trigger === 'online') window.dispatchEvent(new Event('online'))
      else document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(mocks.connect).toHaveBeenCalledOnce()
    expect(mocks.connect.mock.calls[0][0].token).toBe('restored-token')
    emit()
    await waitFor(() => expect(result.current.connectionStatus).toBe('connected'))
  })

  it('stops trailing requests, callbacks, and reconnect timers after unmount', async () => {
    const pending = deferred<Response>()
    mocks.fetch.mockReturnValueOnce(pending.promise)
    const { unmount } = setup()
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())
    emit()
    emit()
    const old = sessions[0]
    unmount()
    await act(async () => { pending.resolve(response()) })
    emit(old)
    act(() => old.options.onError())
    window.dispatchEvent(new Event('online'))
    expect(old.connection.close).toHaveBeenCalledOnce()
    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(sessions).toHaveLength(1)
  })

  it('does not open a socket after unmounting during token restoration', async () => {
    tokenStore.clear()
    const pending = deferred<boolean>()
    mocks.reissue.mockReturnValue(pending.promise)
    const { unmount } = setup()
    unmount()
    tokenStore.set('restored-token')
    await act(async () => { pending.resolve(true) })
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it('keeps only the current subscription through Strict Mode effect cleanup', async () => {
    const { result } = setup(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(sessions).toHaveLength(2)
    expect(sessions[0].connection.close).toHaveBeenCalledOnce()
    emit(sessions[0])
    expect(result.current.connectionStatus).toBe('connecting')
    emit(sessions[1])
    await waitFor(() => expect(result.current.connectionStatus).toBe('connected'))
  })
})
