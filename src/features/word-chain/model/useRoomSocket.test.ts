import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { StompConnection } from '@/shared/ws'

const publish = vi.fn()
const close = vi.fn()
const handlers = new Map<string, (body: unknown) => void>()

const connection: StompConnection = {
  subscribe: (destination, onMessage) => {
    handlers.set(destination, onMessage as (body: unknown) => void)
    return () => handlers.delete(destination)
  },
  publish,
  close,
}

const connectStomp = vi.fn((options: { onConnect: (c: StompConnection) => void }) => {
  options.onConnect(connection)
  return connection
}) as Mock

vi.mock('@/shared/ws', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  connectStomp: (options: never) => connectStomp(options),
}))

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  tokenStore: { get: () => 'token', set: vi.fn(), clear: vi.fn() },
  reissueOnce: vi.fn().mockResolvedValue(undefined),
}))

const { useRoomSocket } = await import('./useRoomSocket')

const ROOM = {
  id: 7,
  name: '점심내기 한판',
  status: 'WAITING',
  hostId: 1,
  capacity: 10,
  players: [{ userId: 1, name: '김성호', avatar: null, ready: true }],
}

describe('useRoomSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
  })

  it('연결되면 방을 구독하고 enter 를 보낸다', async () => {
    renderHook(() => useRoomSocket(7))

    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/enter')
  })

  it('받은 방 상태를 그대로 돌려준다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => handlers.get('/topic/rooms/7')?.(ROOM))

    expect(result.current.room).toEqual(ROOM)
  })

  it('연결이 끊기면 disconnected 가 선다', async () => {
    connectStomp.mockImplementationOnce((options: { onError: () => void }) => {
      options.onError()
      return connection
    })
    const { result } = renderHook(() => useRoomSocket(7))

    await waitFor(() => expect(result.current.disconnected).toBe(true))
  })

  it('오류는 메시지로 꺼낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/user/queue/errors')).toBe(true))

    act(() =>
      handlers.get('/user/queue/errors')?.({ code: 'NOT_ALL_READY', message: '아직 준비 전입니다.' }),
    )

    expect(result.current.error).toBe('아직 준비 전입니다.')
  })

  it('ready 는 토글이 아니라 받은 값을 그대로 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.ready(true))
    act(() => result.current.send.ready(true))
    act(() => result.current.send.ready(false))

    expect(publish.mock.calls.filter(([dest]) => dest === '/app/rooms/7/ready')).toEqual([
      ['/app/rooms/7/ready', { ready: true }],
      ['/app/rooms/7/ready', { ready: true }],
      ['/app/rooms/7/ready', { ready: false }],
    ])
  })

  it('아바타·양도·시작·나가기를 각 목적지로 보낸다', async () => {
    const { result } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    act(() => result.current.send.avatar('FEMALE'))
    act(() => result.current.send.transfer(5))
    act(() => result.current.send.start())
    act(() => result.current.send.leave())

    expect(publish).toHaveBeenCalledWith('/app/rooms/7/avatar', { avatar: 'FEMALE' })
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/transfer', { userId: 5 })
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/start', undefined)
    expect(publish).toHaveBeenCalledWith('/app/rooms/7/leave', undefined)
  })

  it('언마운트되면 연결을 닫는다', async () => {
    const { unmount } = renderHook(() => useRoomSocket(7))
    await waitFor(() => expect(handlers.has('/topic/rooms/7')).toBe(true))

    unmount()

    expect(close).toHaveBeenCalled()
  })
})
