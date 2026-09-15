import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StompConnection } from '@/shared/ws'
import type { ChatMessage, LotteryChatEvent } from '../api/chatTypes'
import { createLotteryChatTransport } from './lotteryChatTransport'
import { useLotteryChat } from './useLotteryChat'

const me = { userId: 1, name: '선도우' }
const other = { userId: 2, name: '육이슬' }
const message = (seq: number, text = `대화 ${seq}`, senderId = 2): ChatMessage => ({
  id: `message-${seq}`, seq, clientMessageId: `client-${seq}`, senderId,
  senderName: senderId === 1 ? me.name : other.name, text, sentAt: '2026-09-15T00:00:00Z', readers: [],
})

const makeSocket = () => {
  const handlers = new Map<string, (event: LotteryChatEvent) => void>()
  const publish = vi.fn()
  const connection: StompConnection = {
    subscribe: (destination, listener) => {
      handlers.set(destination, listener as (event: LotteryChatEvent) => void)
      return () => { handlers.delete(destination) }
    },
    publish,
    close: vi.fn(),
  }
  const ready = (roomId = 'room-one') => handlers.get('/user/queue/lottery-chat')?.({ type: 'READY', roomId })
  return { connection, publish, handlers, ready }
}

const setup = async (open = true) => {
  const socket = makeSocket()
  const transport = createLotteryChatTransport('room-one')
  transport.connect(socket.connection)
  socket.ready()
  const hook = renderHook(({ visible }) => useLotteryChat({ transport, currentUser: me, open: visible }), { initialProps: { visible: open } })
  await act(async () => vi.advanceTimersByTimeAsync(0))
  const emit = (event: LotteryChatEvent) => act(() => socket.handlers.get('/topic/lottery/rooms/room-one/chat')?.(event))
  const latestRequest = () => socket.publish.mock.calls.filter(([destination]) => destination.endsWith('/history')).at(-1)?.[1] as { requestId: string; beforeSeq?: number; query?: string; senderId?: number }
  const page = (messages: ChatMessage[], extra: { hasMore?: boolean; latestSeq?: number; oldestSeq?: number; requestId?: string } = {}) => emit({
    type: 'PAGE', roomId: 'room-one', requestId: latestRequest().requestId, messages,
    hasMore: false, latestSeq: messages.at(-1)?.seq ?? 0, oldestSeq: messages[0]?.seq ?? 0, typing: [], ...extra,
  })
  return { ...hook, ...socket, transport, emit, page, latestRequest }
}

describe('useLotteryChat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads server history and pages before the first loaded sequence, independently of retention bounds', async () => {
    const chat = await setup()
    expect(chat.result.current.loading).toBe(true)
    chat.page([message(901), message(1000)], { hasMore: true, oldestSeq: 1 })
    expect(chat.result.current.messages.map((item) => item.seq)).toEqual([901, 1000])
    act(() => chat.result.current.loadOlder())
    expect(chat.latestRequest().beforeSeq).toBe(901)
    chat.page([message(801), message(900)], { hasMore: true, oldestSeq: 1, latestSeq: 1000 })
    expect(chat.result.current.messages.map((item) => item.seq)).toEqual([801, 900, 901, 1000])
    expect(chat.result.current.loadingOlder).toBe(false)
  })

  it('debounces server searches, ignores abandoned pages and combines search with sender filtering', async () => {
    const chat = await setup()
    const initialRequest = chat.latestRequest().requestId
    chat.page([message(1)])
    act(() => chat.result.current.search('당첨'))
    await act(async () => vi.advanceTimersByTimeAsync(249))
    expect(chat.latestRequest().requestId).toBe(initialRequest)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(chat.latestRequest().query).toBe('당첨')
    chat.page([message(7, '당첨 축하해요')])
    chat.page([message(1)], { requestId: initialRequest })
    expect(chat.result.current.messages.map((item) => item.seq)).toEqual([7])
    act(() => chat.result.current.filterSender(2))
    await act(async () => vi.advanceTimersByTimeAsync(250))
    expect(chat.latestRequest()).toMatchObject({ query: '당첨', senderId: 2 })
    chat.page([message(7, '당첨 축하해요')])
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(8, '다른 대화') })
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(9, '당첨!', 1) })
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(10, '당첨 한 번 더') })
    expect(chat.result.current.messages.map((item) => item.seq)).toEqual([7, 10])
    act(() => { chat.result.current.search(''); chat.result.current.filterSender(null) })
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(chat.latestRequest().query).toBeUndefined()
    expect(chat.latestRequest().senderId).toBeUndefined()
  })

  it('reconciles optimistic sends against both message broadcasts and acknowledgements exactly once', async () => {
    const chat = await setup()
    chat.page([])
    act(() => expect(chat.result.current.send('안녕하세요')).toBe(true))
    const pending = chat.result.current.messages[0]
    expect(pending.delivery).toBe('sending')
    const confirmed = { ...message(1, pending.text, 1), clientMessageId: pending.clientMessageId }
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: confirmed })
    chat.emit({ type: 'ACK', roomId: 'room-one', clientMessageId: pending.clientMessageId, message: confirmed })
    expect(chat.result.current.messages).toHaveLength(1)
    expect(chat.result.current.messages[0]).toMatchObject({ seq: 1, delivery: 'sent' })
    expect(chat.result.current.unreadCount).toBe(0)
  })

  it('accepts 300 Unicode code points and rejects oversized or empty messages', async () => {
    const chat = await setup()
    chat.page([])
    act(() => expect(chat.result.current.send('😀'.repeat(300))).toBe(true))
    act(() => expect(chat.result.current.send('😀'.repeat(301))).toBe(false))
    act(() => expect(chat.result.current.send(' \n ')).toBe(false))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/send'))).toHaveLength(1)
    expect(chat.result.current.error).toContain('300자')
  })

  it('retries an unacknowledged send with the same client id without duplicating it', async () => {
    const chat = await setup()
    chat.page([])
    act(() => chat.result.current.send('재시도'))
    const id = chat.result.current.messages[0].clientMessageId
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(chat.result.current.messages[0].delivery).toBe('failed')
    act(() => expect(chat.result.current.retry(id)).toBe(true))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/send')).map(([, body]) => body.clientMessageId)).toEqual([id, id])
    chat.emit({ type: 'ACK', roomId: 'room-one', clientMessageId: id, message: { ...message(1, '재시도', 1), clientMessageId: id } })
    expect(chat.result.current.messages).toHaveLength(1)
    expect(chat.result.current.messages[0].delivery).toBe('sent')
  })

  it('keeps a pending send outside the active person filter and resolves it from the server ack', async () => {
    const chat = await setup()
    chat.page([])
    act(() => chat.result.current.filterSender(2))
    await act(async () => vi.advanceTimersByTimeAsync(0))
    chat.page([])
    act(() => chat.result.current.send('모두에게'))
    const send = chat.publish.mock.calls.find(([destination]) => destination.endsWith('/send'))?.[1]
    expect(chat.result.current.messages).toEqual([])
    chat.emit({ type: 'ACK', roomId: 'room-one', clientMessageId: send.clientMessageId, message: { ...message(1, '모두에게', 1), clientMessageId: send.clientMessageId } })
    act(() => chat.result.current.filterSender(null))
    await act(async () => vi.advanceTimersByTimeAsync(0))
    chat.page([{ ...message(1, '모두에게', 1), clientMessageId: send.clientMessageId }])
    expect(chat.result.current.messages).toHaveLength(1)
    expect(chat.result.current.messages[0].delivery).toBe('sent')
  })

  it('fails pending sends on disconnect and reconciles accepted sends from history on reconnect', async () => {
    const chat = await setup()
    chat.page([])
    act(() => chat.result.current.send('연결 복구'))
    const id = chat.result.current.messages[0].clientMessageId
    const abandoned = chat.handlers.get('/topic/lottery/rooms/room-one/chat')
    act(() => chat.transport.disconnect())
    expect(chat.result.current.connected).toBe(false)
    expect(chat.result.current.messages[0].delivery).toBe('failed')
    act(() => abandoned?.({ type: 'MESSAGE', roomId: 'room-one', message: message(99) }))
    expect(chat.result.current.messages).toHaveLength(1)
    const fresh = makeSocket()
    act(() => { chat.transport.connect(fresh.connection); fresh.ready() })
    await act(async () => vi.advanceTimersByTimeAsync(0))
    const requestId = fresh.publish.mock.calls.find(([destination]) => destination.endsWith('/history'))?.[1].requestId
    act(() => fresh.handlers.get('/user/queue/lottery-chat')?.({
      type: 'PAGE', roomId: 'room-one', requestId, messages: [{ ...message(1, '연결 복구', 1), clientMessageId: id }],
      hasMore: false, oldestSeq: 1, latestSeq: 1, typing: [],
    }))
    expect(chat.result.current.connected).toBe(true)
    expect(chat.result.current.messages).toHaveLength(1)
    expect(chat.result.current.messages[0].delivery).toBe('sent')
  })

  it('marks only explicitly visible loaded messages read without advancing through a search gap', async () => {
    const chat = await setup()
    chat.page([message(1), message(2), message(3), message(4, '내 대화', 1)])
    act(() => chat.result.current.markRead([1, 3, 3, 4, 9999]))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/read')).map(([, body]) => body.seqs)).toEqual([[1, 3]])
    act(() => chat.result.current.markRead([1, 3]))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/read'))).toHaveLength(1)
    chat.emit({ type: 'READ', roomId: 'room-one', seqs: [3], reader: other })
    chat.emit({ type: 'READ', roomId: 'room-one', seqs: [3], reader: other })
    expect(chat.result.current.messages[2].readers).toEqual([other])
  })

  it('does not send read receipts from closed panels or hidden tabs', async () => {
    const chat = await setup(false)
    chat.page([message(1)])
    act(() => chat.result.current.markRead([1]))
    chat.rerender({ visible: true })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => chat.result.current.markRead([1]))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/read'))).toHaveLength(0)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => chat.result.current.markRead([1]))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/read'))).toHaveLength(1)
  })

  it('bounds read batches and removes unread badges only for viewed messages', async () => {
    const chat = await setup()
    chat.page([])
    for (let seq = 1; seq <= 101; seq += 1) chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(seq) })
    expect(chat.result.current.unreadCount).toBe(101)
    act(() => chat.result.current.markRead(Array.from({ length: 101 }, (_, index) => index + 1)))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/read')).map(([, body]) => body.seqs.length)).toEqual([100, 1])
    expect(chat.result.current.unreadCount).toBe(0)
  })

  it('preserves live read receipt updates when an older page snapshot arrives', async () => {
    const chat = await setup()
    chat.page([message(1)])
    act(() => chat.result.current.search(''))
    chat.emit({ type: 'READ', roomId: 'room-one', seqs: [1], reader: me })
    chat.page([message(1)])
    expect(chat.result.current.messages[0].readers).toEqual([me])
  })

  it('throttles typing publications, expires own typing and stops when the panel closes', async () => {
    const chat = await setup()
    chat.page([])
    act(() => chat.result.current.setTyping(true))
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    act(() => chat.result.current.setTyping(true))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/typing'))).toHaveLength(1)
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    act(() => chat.result.current.setTyping(true))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/typing'))).toHaveLength(2)
    await act(async () => vi.advanceTimersByTimeAsync(5000))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/typing')).at(-1)?.[1]).toEqual({ typing: false })
    act(() => chat.result.current.setTyping(true))
    chat.rerender({ visible: false })
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/typing')).at(-1)?.[1]).toEqual({ typing: false })
  })

  it('keeps remote typing until the server expiry event even if the active list is unchanged', async () => {
    const chat = await setup()
    chat.page([])
    chat.emit({ type: 'TYPING', roomId: 'room-one', people: [me, other] })
    await act(async () => vi.advanceTimersByTimeAsync(20_000))
    expect(chat.result.current.typing).toEqual([other])
    chat.emit({ type: 'TYPING', roomId: 'room-one', people: [] })
    expect(chat.result.current.typing).toEqual([])
  })

  it('stops own typing when the tab becomes hidden', async () => {
    const chat = await setup()
    chat.page([])
    act(() => chat.result.current.setTyping(true))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(chat.publish.mock.calls.filter(([destination]) => destination.endsWith('/typing')).at(-1)?.[1]).toEqual({ typing: false })
  })

  it('routes correlated send errors to the failed message without replacing history', async () => {
    const chat = await setup()
    chat.page([message(1)])
    act(() => chat.result.current.send('잠깐'))
    const id = chat.result.current.messages[1].clientMessageId
    chat.emit({ type: 'ERROR', roomId: 'room-one', clientMessageId: id, code: 'CHAT_RATE_LIMIT', message: '잠시 후 보내 주세요.' })
    expect(chat.result.current.error).toBeNull()
    expect(chat.result.current.messages[1]).toMatchObject({ delivery: 'failed', failure: '잠시 후 보내 주세요.' })
    expect(chat.result.current.messages[0].seq).toBe(1)
  })

  it('exposes a retry for history timeout and ignores its late response', async () => {
    const chat = await setup()
    const abandoned = chat.latestRequest().requestId
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(chat.result.current.loading).toBe(false)
    expect(chat.result.current.error).toContain('불러오지 못했어요')
    act(() => chat.result.current.search(''))
    chat.page([message(1)], { requestId: abandoned })
    expect(chat.result.current.messages).toEqual([])
    chat.page([message(2)])
    expect(chat.result.current.messages[0].seq).toBe(2)
    expect(chat.result.current.error).toBeNull()
  })

  it('prunes expired messages even if later live messages do not match the current search', async () => {
    const chat = await setup()
    chat.page([message(1, '당첨')])
    act(() => chat.result.current.search('당첨'))
    await act(async () => vi.advanceTimersByTimeAsync(250))
    chat.page([message(1, '당첨')], { oldestSeq: 1, latestSeq: 1000 })
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(1001, '다른 대화') })
    expect(chat.result.current.messages).toEqual([])
    expect(chat.result.current.latestSeq).toBe(1001)
  })

  it('does not let a delayed page roll back newer typing or retention state', async () => {
    const chat = await setup()
    chat.emit({ type: 'TYPING', roomId: 'room-one', people: [other] })
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(1001) })
    chat.page([message(1), message(1000)], { latestSeq: 1000, oldestSeq: 1 })
    expect(chat.result.current.messages.map((item) => item.seq)).toEqual([1000, 1001])
    expect(chat.result.current.typing).toEqual([other])
  })

  it('reconciles unread badges when restored history reports reads from another tab', async () => {
    const chat = await setup(false)
    chat.page([])
    chat.emit({ type: 'MESSAGE', roomId: 'room-one', message: message(1) })
    expect(chat.result.current.unreadCount).toBe(1)
    act(() => chat.result.current.search(''))
    chat.page([{ ...message(1), readers: [me] }])
    expect(chat.result.current.unreadCount).toBe(0)
  })

  it('clears messages and failed sends when the hook changes to a different room', async () => {
    const first = createLotteryChatTransport('room-one')
    const firstSocket = makeSocket()
    first.connect(firstSocket.connection)
    firstSocket.ready()
    const second = createLotteryChatTransport('room-two')
    const secondSocket = makeSocket()
    second.connect(secondSocket.connection)
    secondSocket.ready('room-two')
    const hook = renderHook(({ transport }) => useLotteryChat({ transport, currentUser: me, open: true }), { initialProps: { transport: first } })
    await act(async () => vi.advanceTimersByTimeAsync(0))
    act(() => hook.result.current.send('첫 번째 방 메시지'))
    expect(hook.result.current.messages).toHaveLength(1)
    hook.rerender({ transport: second })
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(hook.result.current.messages).toEqual([])
    expect(secondSocket.publish.mock.calls.some(([destination]) => destination === '/app/lottery/rooms/room-two/chat/history')).toBe(true)
    expect(secondSocket.publish.mock.calls.some(([destination]) => destination.endsWith('/send'))).toBe(false)
  })
  it('does not request history until the room transport receives READY', async () => {
    const socket = makeSocket()
    const transport = createLotteryChatTransport('room-one')
    transport.connect(socket.connection)
    const { result } = renderHook(() => useLotteryChat({ transport, currentUser: me, open: true }))
    await act(async () => vi.advanceTimersByTimeAsync(2000))
    expect(result.current.connected).toBe(false)
    expect(socket.publish).not.toHaveBeenCalled()
    act(() => socket.ready())
    await act(async () => vi.advanceTimersByTimeAsync(0))
    expect(result.current.connected).toBe(true)
    expect(socket.publish).toHaveBeenCalledWith('/app/lottery/rooms/room-one/chat/history', expect.objectContaining({ requestId: expect.any(String) }))
  })})
