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

const { connectStomp } = await import('./stompClient')

describe('connectStomp', () => {
  beforeEach(() => {
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
    ;(captured.onStompError as () => void)()
    ;(captured.onWebSocketError as () => void)()

    expect(onError).toHaveBeenCalledTimes(2)
  })
})
