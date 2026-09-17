import { beforeEach, describe, expect, it, vi } from 'vitest'

const activate = vi.fn()
const deactivate = vi.fn()
const publish = vi.fn()
const subscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
let captured: Record<string, unknown> = {}

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation(function (config: Record<string, unknown>) {
    captured = config
    return { activate, deactivate, publish, subscribe, connected: true }
  }),
}))

const { sessionStore } = await import('../api/sessionStore')

const { connectStomp } = await import('./stompClient')

describe('connectStomp', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStore.end('UNAUTHENTICATED', false)
    sessionStore.beginLogin()
    vi.clearAllMocks()
  })

  it('토큰을 CONNECT 헤더에 싣는다', () => {
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })

    expect(captured.connectHeaders).toEqual({ Authorization: 'Bearer abc' })
    expect(captured.brokerURL).toBe('ws://x/api/ws')
    expect(activate).toHaveBeenCalled()
  })

  it('스스로 재연결하지 않는다', () => {
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })

    expect(captured.reconnectDelay).toBe(0)
  })

  it('연결되면 onConnect 에 연결 객체를 넘긴다', () => {
    const onConnect = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect, onError: vi.fn() })
    ;(captured.onConnect as () => void)()

    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect.mock.calls[0][0]).toHaveProperty('publish')
  })

  it('본문을 JSON 으로 보낸다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })

    connection.publish('/app/rooms/1/ready', { ready: true })

    expect(publish).toHaveBeenCalledWith({
      destination: '/app/rooms/1/ready',
      body: '{"ready":true}',
      headers: { 'content-type': 'application/json' },
    })
  })

  it('본문이 없으면 빈 문자열을 보낸다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })

    connection.publish('/app/rooms/1/enter')

    expect(publish).toHaveBeenCalledWith({ destination: '/app/rooms/1/enter', body: '' })
  })

  it('구독은 받은 JSON 을 풀어서 넘긴다', () => {
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError: vi.fn(),
    })
    const onMessage = vi.fn()
    connection.subscribe('/topic/rooms/1', onMessage)

    const handler = subscribe.mock.calls[0][1] as (m: { body: string }) => void
    handler({ body: '{"id":1}' })

    expect(onMessage).toHaveBeenCalledWith({ id: 1 })
  })

  it('STOMP 오류와 소켓 오류 모두 onError 를 부른다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onStompError as (frame: { body: string }) => void)({ body: '' })
    ;(captured.onWebSocketError as () => void)()

    expect(onError).toHaveBeenCalledTimes(2)
  })

  it('ERROR 프레임 본문의 사유를 넘긴다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onStompError as (frame: { body: string }) => void)({
      body: '{"code":"NOT_IN_ROOM","message":"이 방의 참가자가 아닙니다."}',
    })

    expect(onError).toHaveBeenCalledWith({
      code: 'NOT_IN_ROOM',
      message: '이 방의 참가자가 아닙니다.',
    })
  })

  it('본문이 JSON 이 아니면 사유 없이 부른다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onStompError as (frame: { body: string }) => void)({ body: 'Failed to send' })

    expect(onError).toHaveBeenCalledWith(undefined)
  })

  it('소켓 오류에는 실을 사유가 없다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onWebSocketError as () => void)()

    expect(onError).toHaveBeenCalledWith()
  })

  it('서버가 소켓을 닫으면 onError 를 부른다', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onWebSocketClose as () => void)()

    expect(onError).toHaveBeenCalledWith()
  })

  it('내가 닫은 것은 끊김이 아니다', () => {
    const onError = vi.fn()
    const connection = connectStomp({
      url: 'ws://x/api/ws',
      token: 'abc',
      onConnect: vi.fn(),
      onError,
    })

    connection.close()
    ;(captured.onWebSocketClose as () => void)()

    expect(deactivate).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('session-aware socket cleanup', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStore.end('UNAUTHENTICATED', false)
    sessionStore.beginLogin()
    vi.clearAllMocks()
  })

  it.each(['SESSION_IDLE_EXPIRED', 'SESSION_ABSOLUTE_EXPIRED', 'SESSION_REVOKED'])(
    'stops publishing and reconnect callbacks after %s close',
    (reason) => {
      const onError = vi.fn()
      const connection = connectStomp({
        url: 'ws://x/api/ws',
        token: 'abc',
        onConnect: vi.fn(),
        onError,
      })
      ;(captured.onWebSocketClose as (event: { code: number; reason: string }) => void)({
        code: 4001,
        reason,
      })
      connection.publish('/app/rooms/1/ready')
      expect(sessionStore.get().reason).toBe(reason)
      expect(deactivate).toHaveBeenCalled()
      expect(publish).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    },
  )

  it('keeps authentication after a transient server close', () => {
    const onError = vi.fn()
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError })
    ;(captured.onWebSocketClose as (event: { code: number; reason: string }) => void)({
      code: 1011,
      reason: 'authentication service unavailable',
    })
    expect(sessionStore.get().ended).toBe(false)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('closes all connections when logout is signalled', () => {
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })
    connectStomp({ url: 'ws://x/api/ws', token: 'abc', onConnect: vi.fn(), onError: vi.fn() })
    sessionStore.end('LOGOUT', false)
    expect(deactivate).toHaveBeenCalledTimes(2)
  })
})
