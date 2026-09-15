import { describe, expect, it, vi } from 'vitest'
import type { StompConnection } from '@/shared/ws'
import type { LotteryChatEvent } from '../api/chatTypes'
import { createLotteryChatTransport } from './lotteryChatTransport'

const createSocket = () => {
  const handlers = new Map<string, (event: LotteryChatEvent) => void>()
  const unsubscribe = vi.fn()
  const connection: StompConnection = {
    subscribe: (destination, listener) => {
      handlers.set(destination, listener as (event: LotteryChatEvent) => void)
      return unsubscribe
    },
    publish: vi.fn(),
    close: vi.fn(),
  }
  const ready = () => handlers.get('/user/queue/lottery-chat')?.({ type: 'READY', roomId: 'room-one' })
  return { handlers, unsubscribe, connection, ready }
}

describe('lotteryChatTransport', () => {
  it('accepts room-scoped broadcasts and private replies but ignores other rooms and abandoned sockets', () => {
    const transport = createLotteryChatTransport('room-one')
    const first = createSocket()
    const listener = vi.fn()
    transport.subscribe(listener)
    transport.connect(first.connection)
    first.ready()
    const event: LotteryChatEvent = { type: 'TYPING', roomId: 'room-one', people: [] }
    first.handlers.get('/user/queue/lottery-chat')?.({ ...event, roomId: 'another-room' })
    first.handlers.get('/topic/lottery/rooms/room-one/chat')?.(event)
    expect(listener).toHaveBeenCalledExactlyOnceWith(event)
    const second = createSocket()
    transport.connect(second.connection)
    second.ready()
    first.handlers.get('/user/queue/lottery-chat')?.(event)
    expect(listener).toHaveBeenCalledTimes(1)
    second.handlers.get('/user/queue/lottery-chat')?.(event)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('finishes every cleanup when an already closed socket throws during unsubscribe', () => {
    const transport = createLotteryChatTransport('room-one')
    const socket = createSocket()
    const listener = vi.fn()
    transport.subscribeConnection(listener)
    transport.connect(socket.connection)
    socket.ready()
    socket.unsubscribe.mockImplementation(() => { throw new Error('Socket already closed') })
    expect(() => transport.disconnect()).not.toThrow()
    expect(socket.unsubscribe).toHaveBeenCalledTimes(2)
    expect(transport.isConnected()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(socket.connection.close).not.toHaveBeenCalled()
  })

  it('publishes on the existing connection and reports unavailable or failed sends to its consumer', () => {
    const transport = createLotteryChatTransport('room-one')
    expect(transport.publish('typing', { typing: true })).toBe(false)
    const socket = createSocket()
    transport.connect(socket.connection)
    socket.ready()
    expect(transport.publish('typing', { typing: true })).toBe(true)
    expect(socket.connection.publish).toHaveBeenCalledWith('/app/lottery/rooms/room-one/chat/typing', { typing: true })
    vi.mocked(socket.connection.publish).mockImplementation(() => { throw new Error('Disconnected') })
    expect(transport.publish('typing', { typing: false })).toBe(false)
  })

  it('blocks chat commands until the private READY frame confirms broker subscriptions and entry', () => {
    const transport = createLotteryChatTransport('room-one')
    const socket = createSocket()
    const status = vi.fn()
    transport.subscribeConnection(status)
    transport.connect(socket.connection)
    expect(transport.isConnected()).toBe(false)
    expect(transport.publish('history', { requestId: 'early' })).toBe(false)
    socket.handlers.get('/topic/lottery/rooms/room-one/chat')?.({ type: 'READY', roomId: 'room-one' })
    socket.handlers.get('/user/queue/lottery-chat')?.({ type: 'READY', roomId: 'wrong-room' })
    expect(transport.isConnected()).toBe(false)
    expect(status).not.toHaveBeenCalled()
    socket.ready()
    socket.ready()
    expect(transport.isConnected()).toBe(true)
    expect(status).toHaveBeenCalledOnce()
    expect(transport.publish('history', { requestId: 'ready' })).toBe(true)
  })

  it('ignores a stale READY frame from a replaced socket', () => {
    const transport = createLotteryChatTransport('room-one')
    const first = createSocket()
    transport.connect(first.connection)
    const oldReady = first.handlers.get('/user/queue/lottery-chat')
    const second = createSocket()
    transport.connect(second.connection)
    oldReady?.({ type: 'READY', roomId: 'room-one' })
    expect(transport.isConnected()).toBe(false)
    second.ready()
    expect(transport.isConnected()).toBe(true)
  })})
