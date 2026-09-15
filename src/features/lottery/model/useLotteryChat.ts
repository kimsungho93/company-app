import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChatDisplayMessage, ChatMessage, ChatPerson, LotteryChatEvent } from '../api/chatTypes'
import type { LotteryChatTransport } from './lotteryChatTransport'

interface ChatState {
  confirmed: ChatMessage[]
  pending: ChatDisplayMessage[]
  query: string
  senderId: number | null
  typing: ChatPerson[]
  loading: boolean
  loadingOlder: boolean
  hasMore: boolean
  latestSeq: number
  oldestSeq: number
  unread: number[]
  error: string | null
}

export interface LotteryChatState {
  messages: ChatDisplayMessage[]
  connected: boolean
  loading: boolean
  loadingOlder: boolean
  hasMore: boolean
  error: string | null
  query: string
  senderId: number | null
  typing: ChatPerson[]
  latestSeq: number
  unreadCount: number
  send: (text: string) => boolean
  retry: (clientMessageId: string) => boolean
  loadOlder: () => void
  search: (query: string) => void
  filterSender: (userId: number | null) => void
  markRead: (seqs: number[]) => void
  setTyping: (typing: boolean) => void
  clearError: () => void
}

const initialState = (): ChatState => ({
  confirmed: [], pending: [], query: '', senderId: null, typing: [],
  loading: false, loadingOlder: false, hasMore: false, latestSeq: 0, oldestSeq: 0, unread: [], error: null,
})

const matches = (message: ChatMessage, state: Pick<ChatState, 'query' | 'senderId'>) =>
  (state.senderId === null || message.senderId === state.senderId)
  && message.text.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase())

const combine = (previous: ChatMessage[], incoming: ChatMessage[], oldestSeq: number) => {
  const messages = new Map(previous.map((message) => [message.seq, message]))
  incoming.forEach((message) => {
    const existing = messages.get(message.seq)
    const readers = new Map([...(existing?.readers ?? []), ...message.readers].map((reader) => [reader.userId, reader]))
    messages.set(message.seq, { ...message, readers: [...readers.values()] })
  })
  return [...messages.values()].filter((message) => message.seq >= oldestSeq).sort((a, b) => a.seq - b.seq).slice(-1000)
}

export const useLotteryChat = ({ transport, currentUser, open }: {
  transport: LotteryChatTransport
  currentUser: ChatPerson
  open: boolean
}): LotteryChatState => {
  const connected = useSyncExternalStore(transport.subscribeConnection, transport.isConnected, () => false)
  const [state, setState] = useState<ChatState>(initialState)
  const stateRef = useRef(state)
  const openRef = useRef(open)
  openRef.current = open
  const { userId, name } = currentUser
  const identity = useRef({ transport, userId })
  const typingRevision = useRef(0)
  const requests = useRef(new Map<string, { older: boolean; timer: ReturnType<typeof setTimeout>; typingRevision: number }>())
  const sends = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const readSent = useRef(new Set<number>())
  const typingState = useRef({ active: false, lastSent: 0 })
  const typingStop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const update = useCallback((reduce: (previous: ChatState) => ChatState) => {
    const next = reduce(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  const cancelRequests = useCallback(() => {
    requests.current.forEach(({ timer }) => clearTimeout(timer))
    requests.current.clear()
  }, [])

  const requestHistory = useCallback((older = false) => {
    const current = stateRef.current
    if (!transport.isConnected() || (older && (!current.hasMore || current.loading || current.loadingOlder))) return
    const requestId = crypto.randomUUID()
    const beforeSeq = older ? current.confirmed[0]?.seq : undefined
    if (older && beforeSeq === undefined) return
    const timer = setTimeout(() => {
      if (!requests.current.delete(requestId)) return
      update((previous) => ({
        ...previous, loading: false, loadingOlder: false, error: '대화를 불러오지 못했어요. 다시 시도해 주세요.',
      }))
    }, 10_000)
    requests.current.set(requestId, { older, timer, typingRevision: typingRevision.current })
    update((previous) => ({ ...previous, loading: !older, loadingOlder: older, error: null }))
    const sent = transport.publish('history', {
      requestId,
      ...(beforeSeq === undefined ? {} : { beforeSeq }),
      ...(current.query.trim() ? { query: current.query.trim() } : {}),
      ...(current.senderId === null ? {} : { senderId: current.senderId }),
    })
    if (!sent) {
      clearTimeout(timer)
      requests.current.delete(requestId)
      update((previous) => ({ ...previous, loading: false, loadingOlder: false, error: '채팅 연결을 확인해 주세요.' }))
    }
  }, [transport, update])

  const setTyping = useCallback((typing: boolean) => {
    clearTimeout(typingStop.current)
    const next = typing && openRef.current && document.visibilityState === 'visible' && transport.isConnected()
    if (!next) {
      if (typingState.current.active) transport.publish('typing', { typing: false })
      typingState.current = { active: false, lastSent: 0 }
      return
    }
    const now = Date.now()
    if (!typingState.current.active || now - typingState.current.lastSent >= 2000) {
      if (transport.publish('typing', { typing: true })) typingState.current = { active: true, lastSent: now }
    }
    typingStop.current = setTimeout(() => {
      if (typingState.current.active) transport.publish('typing', { typing: false })
      typingState.current = { active: false, lastSent: 0 }
    }, 5000)
  }, [transport])

  const acceptTyping = useCallback((people: ChatPerson[]) => {
    update((previous) => ({ ...previous, typing: people.filter((person) => person.userId !== userId) }))
  }, [update, userId])

  useEffect(() => {
    if (identity.current.transport === transport && identity.current.userId === userId) return
    identity.current = { transport, userId }
    readSent.current.clear()
    update(initialState)
  }, [transport, userId, update])

  useEffect(() => {
    const activeSends = sends.current
    const receive = (event: LotteryChatEvent) => {
      if (event.roomId !== transport.roomId) return
      if (event.type === 'PAGE') {
        const request = requests.current.get(event.requestId)
        if (!request) return
        clearTimeout(request.timer)
        requests.current.delete(event.requestId)
        const oldestSeq = Math.max(stateRef.current.oldestSeq, event.oldestSeq)
        const alreadyRead = new Set(event.messages.filter((message) => message.readers.some((reader) => reader.userId === userId)).map((message) => message.seq))
        const resolved = new Set(event.messages.filter((message) => message.senderId === userId).map((message) => message.clientMessageId))
        resolved.forEach((id) => { clearTimeout(sends.current.get(id)); sends.current.delete(id) })
        update((previous) => ({
          ...previous,
          confirmed: combine(request.older ? previous.confirmed : previous.confirmed.filter((message) => message.seq > event.latestSeq || event.messages.some((item) => item.seq === message.seq)), event.messages, oldestSeq),
          pending: previous.pending.filter((message) => !resolved.has(message.clientMessageId)),
          loading: false,
          loadingOlder: false,
          hasMore: event.hasMore,
          latestSeq: Math.max(previous.latestSeq, event.latestSeq),
          oldestSeq,
          unread: previous.unread.filter((seq) => seq >= oldestSeq && !alreadyRead.has(seq)),
          error: null,
        }))
        readSent.current = new Set([...readSent.current].filter((seq) => seq >= oldestSeq))
        if (request.typingRevision === typingRevision.current) acceptTyping(event.typing)
      } else if (event.type === 'MESSAGE' || event.type === 'ACK') {
        const message = event.message
        const oldestSeq = Math.max(stateRef.current.oldestSeq, message.seq - 999)
        readSent.current = new Set([...readSent.current].filter((seq) => seq >= oldestSeq))
        if (message.senderId === userId) {
          clearTimeout(sends.current.get(message.clientMessageId))
          sends.current.delete(message.clientMessageId)
        }
        update((previous) => ({
          ...previous,
          confirmed: combine(previous.confirmed, matches(message, previous) ? [message] : [], oldestSeq),
          oldestSeq,
          pending: message.senderId === userId ? previous.pending.filter((item) => item.clientMessageId !== message.clientMessageId) : previous.pending,
          latestSeq: Math.max(previous.latestSeq, message.seq),
          unread: message.seq >= oldestSeq && message.senderId !== userId && !readSent.current.has(message.seq) && !message.readers.some((reader) => reader.userId === userId)
            ? [...new Set([...previous.unread, message.seq])].filter((seq) => seq >= oldestSeq).slice(-1000) : previous.unread.filter((seq) => seq >= oldestSeq),
        }))
      } else if (event.type === 'READ') {
        const seqs = new Set(event.seqs)
        update((previous) => ({
          ...previous,
          confirmed: previous.confirmed.map((message) => seqs.has(message.seq) && !message.readers.some((reader) => reader.userId === event.reader.userId)
            ? { ...message, readers: [...message.readers, event.reader] } : message),
          unread: event.reader.userId === userId ? previous.unread.filter((seq) => !seqs.has(seq)) : previous.unread,
        }))
      } else if (event.type === 'TYPING') {
        typingRevision.current += 1
        acceptTyping(event.people)
      } else if (event.type === 'ERROR') {
        if (event.clientMessageId) {
          clearTimeout(sends.current.get(event.clientMessageId))
          sends.current.delete(event.clientMessageId)
          update((previous) => ({
            ...previous,
            pending: previous.pending.map((message) => message.clientMessageId === event.clientMessageId
              ? { ...message, delivery: 'failed', failure: event.message } : message),
          }))
        } else if (event.requestId) {
          const request = requests.current.get(event.requestId)
          if (!request) return
          clearTimeout(request.timer)
          requests.current.delete(event.requestId)
          update((previous) => ({ ...previous, loading: false, loadingOlder: false, error: event.message }))
        } else {
          update((previous) => ({ ...previous, error: event.message }))
        }
      }
    }
    const unsubscribe = transport.subscribe(receive)
    return () => {
      unsubscribe()
      cancelRequests()
      activeSends.forEach((timer) => clearTimeout(timer))
      activeSends.clear()
      setTyping(false)
    }
  }, [transport, userId, update, acceptTyping, cancelRequests, setTyping])

  useEffect(() => {
    cancelRequests()
    readSent.current.clear()
    if (!connected) {
      sends.current.forEach((timer) => clearTimeout(timer))
      sends.current.clear()
      setTyping(false)
      update((previous) => ({
        ...previous, loading: false, loadingOlder: false, typing: [],
        pending: previous.pending.map((message) => message.delivery === 'sending'
          ? { ...message, delivery: 'failed', failure: '연결이 끊겼어요. 다시 연결한 뒤 재시도해 주세요.' } : message),
      }))
      return
    }
    update((previous) => ({ ...previous, loading: true, loadingOlder: false, error: null }))
    const timer = setTimeout(() => requestHistory(), state.query ? 250 : 0)
    return () => { clearTimeout(timer); cancelRequests() }
  }, [connected, transport, state.query, state.senderId, cancelRequests, requestHistory, setTyping, update])

  useEffect(() => {
    if (!open) setTyping(false)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') setTyping(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [open, setTyping])

  const publishMessage = useCallback((message: ChatDisplayMessage) => {
    clearTimeout(sends.current.get(message.clientMessageId))
    const timer = setTimeout(() => {
      sends.current.delete(message.clientMessageId)
      update((previous) => ({
        ...previous,
        pending: previous.pending.map((item) => item.clientMessageId === message.clientMessageId && item.delivery === 'sending'
          ? { ...item, delivery: 'failed', failure: '전송을 확인하지 못했어요. 재시도해 주세요.' } : item),
      }))
    }, 10_000)
    sends.current.set(message.clientMessageId, timer)
    if (!transport.publish('send', { clientMessageId: message.clientMessageId, text: message.text })) {
      clearTimeout(timer)
      sends.current.delete(message.clientMessageId)
      update((previous) => ({
        ...previous,
        pending: previous.pending.map((item) => item.clientMessageId === message.clientMessageId
          ? { ...item, delivery: 'failed', failure: '전송하지 못했어요. 다시 시도해 주세요.' } : item),
      }))
    }
  }, [transport, update])

  const send = useCallback((value: string) => {
    const text = value.trim()
    if (!text) return false
    if (!transport.isConnected()) {
      update((previous) => ({ ...previous, error: '다시 연결한 뒤 메시지를 보내 주세요.' }))
      return false
    }
    if ([...text].length > 300) {
      update((previous) => ({ ...previous, error: '메시지는 300자까지 보낼 수 있어요.' }))
      return false
    }
    if (stateRef.current.pending.length >= 20) {
      update((previous) => ({ ...previous, error: '전송하지 못한 메시지를 먼저 재시도해 주세요.' }))
      return false
    }
    const clientMessageId = crypto.randomUUID()
    const message: ChatDisplayMessage = {
      id: clientMessageId, seq: 0, clientMessageId, senderId: userId, senderName: name, text,
      sentAt: new Date().toISOString(), readers: [], delivery: 'sending',
    }
    update((previous) => ({ ...previous, pending: [...previous.pending, message], error: null }))
    setTyping(false)
    publishMessage(message)
    return true
  }, [transport, userId, name, publishMessage, setTyping, update])

  const retry = useCallback((clientMessageId: string) => {
    const message = stateRef.current.pending.find((item) => item.clientMessageId === clientMessageId && item.delivery === 'failed')
    if (!message || !transport.isConnected()) return false
    update((previous) => ({
      ...previous, error: null,
      pending: previous.pending.map((item) => item.clientMessageId === clientMessageId ? { ...item, delivery: 'sending', failure: undefined } : item),
    }))
    publishMessage(message)
    return true
  }, [transport, publishMessage, update])

  const markRead = useCallback((seqs: number[]) => {
    if (!openRef.current || document.visibilityState !== 'visible' || !transport.isConnected()) return
    const available = new Map(stateRef.current.confirmed.map((message) => [message.seq, message]))
    const unread = [...new Set(seqs)].filter((seq) => {
      const message = available.get(seq)
      return message && message.senderId !== userId && !readSent.current.has(seq) && !message.readers.some((reader) => reader.userId === userId)
    })
    if (!unread.length) return
    for (let offset = 0; offset < unread.length; offset += 100) {
      const batch = unread.slice(offset, offset + 100)
      if (transport.publish('read', { seqs: batch })) batch.forEach((seq) => readSent.current.add(seq))
    }
    update((previous) => ({ ...previous, unread: previous.unread.filter((seq) => !readSent.current.has(seq)) }))
  }, [transport, update, userId])

  const search = useCallback((query: string) => {
    if (query === stateRef.current.query) {
      cancelRequests()
      requestHistory()
      return
    }
    cancelRequests()
    update((previous) => ({ ...previous, query, confirmed: [], hasMore: false, error: null }))
  }, [update, cancelRequests, requestHistory])

  const filterSender = useCallback((senderId: number | null) => {
    if (senderId === stateRef.current.senderId) return
    cancelRequests()
    update((previous) => ({ ...previous, senderId, confirmed: [], hasMore: false, error: null }))
  }, [update, cancelRequests])

  return {
    messages: [
      ...state.confirmed.map((message): ChatDisplayMessage => ({ ...message, delivery: 'sent' })),
      ...state.pending.filter((message) => matches(message, state)),
    ],
    connected,
    loading: state.loading,
    loadingOlder: state.loadingOlder,
    hasMore: state.hasMore,
    error: state.error,
    query: state.query,
    senderId: state.senderId,
    typing: state.typing,
    latestSeq: state.latestSeq,
    unreadCount: state.unread.length,
    send,
    retry,
    loadOlder: () => requestHistory(true),
    search,
    filterSender,
    markRead,
    setTyping,
    clearError: () => update((previous) => ({ ...previous, error: null })),
  }
}
