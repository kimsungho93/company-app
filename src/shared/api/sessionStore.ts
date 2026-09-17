import { tokenStore } from './tokenStore'

export interface SessionMetadata {
  sessionId: string
  serverTime: string
  idleExpiresAt: string
  absoluteExpiresAt: string
}

export type SessionEndReason =
  | 'SESSION_IDLE_EXPIRED'
  | 'SESSION_ABSOLUTE_EXPIRED'
  | 'SESSION_REVOKED'
  | 'UNAUTHENTICATED'
  | 'LOGOUT'

export interface SessionSnapshot {
  session: SessionMetadata | null
  clockOffset: number
  reason: SessionEndReason | null
  ended: boolean
}

type SessionEvent = { type: 'ended'; reason: SessionEndReason } | { type: 'started' }
type Message =
  | { type: 'session'; session: SessionMetadata; started: boolean }
  | { type: 'ended'; sessionId: string | null; reason: SessionEndReason }

let snapshot: SessionSnapshot = { session: null, clockOffset: 0, reason: null, ended: false }
const listeners = new Set<() => void>()
const eventListeners = new Set<(event: SessionEvent) => void>()
let channel: BroadcastChannel | null = null
let initialized = false
const STORAGE_KEY = 'company.auth.session-event'
const LOGOUT_KEY = 'company.auth.logout-pending'
let pendingLogout: string | null = null

export const getPendingLogout = (): string | null => {
  try {
    return localStorage.getItem(LOGOUT_KEY)
  } catch {
    return pendingLogout
  }
}

export const clearPendingLogout = (marker: string | null): void => {
  if (getPendingLogout() !== marker) return
  pendingLogout = null
  try {
    localStorage.removeItem(LOGOUT_KEY)
  } catch {
    return
  }
}

const notify = () => listeners.forEach((listener) => listener())

export const isSessionEndCode = (code: unknown): code is SessionEndReason =>
  code === 'SESSION_IDLE_EXPIRED' ||
  code === 'SESSION_ABSOLUTE_EXPIRED' ||
  code === 'SESSION_REVOKED'

export const sessionEndReasonFor = (code: unknown): SessionEndReason => {
  if (isSessionEndCode(code)) return code
  const now = Date.now() + snapshot.clockOffset
  if (snapshot.session && Date.parse(snapshot.session.absoluteExpiresAt) <= now)
    return 'SESSION_ABSOLUTE_EXPIRED'
  if (snapshot.session && Date.parse(snapshot.session.idleExpiresAt) <= now)
    return 'SESSION_IDLE_EXPIRED'
  return 'UNAUTHENTICATED'
}

export const errorCode = (body: unknown): string | undefined =>
  body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
    ? body.code
    : undefined

export const isSessionMetadata = (value: unknown): value is SessionMetadata => {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<SessionMetadata>
  return (
    typeof data.sessionId === 'string' &&
    data.sessionId.length > 0 &&
    [data.serverTime, data.idleExpiresAt, data.absoluteExpiresAt].every(
      (date) => typeof date === 'string' && Number.isFinite(Date.parse(date)),
    )
  )
}

const publish = (message: Message) => {
  if (channel) {
    channel.postMessage(message)
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...message, nonce: crypto.randomUUID() }))
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

const receive = (message: Message) => {
  if (message.type === 'ended') {
    if (
      !message.sessionId ||
      !snapshot.session ||
      message.sessionId === snapshot.session.sessionId
    ) {
      sessionStore.end(message.reason, false, false)
    }
  } else if (message.type === 'session' && isSessionMetadata(message.session)) {
    if (message.started) {
      tokenStore.clear()
      sessionStore.accept(message.session, true, false)
    } else if (!snapshot.ended && message.session.sessionId === snapshot.session?.sessionId) {
      sessionStore.accept(message.session, false, false)
    }
  }
}

export const sessionStore = {
  get: (): SessionSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  onEvent(listener: (event: SessionEvent) => void): () => void {
    eventListeners.add(listener)
    return () => {
      eventListeners.delete(listener)
    }
  },
  initialize(): void {
    if (initialized || typeof window === 'undefined') return
    initialized = true
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('company.auth.session')
      channel.onmessage = (event: MessageEvent<Message>) => receive(event.data)
    } else {
      window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return
        try {
          receive(JSON.parse(event.newValue) as Message)
        } catch {
          return
        }
      })
    }
  },
  beginLogin(): number {
    tokenStore.invalidate()
    snapshot = { ...snapshot, reason: null, ended: false }
    notify()
    return tokenStore.generation()
  },
  accept(session: unknown, started = false, broadcast = true): void {
    if (started) clearPendingLogout(getPendingLogout())
    if (!isSessionMetadata(session)) return
    if (!started && snapshot.ended) return
    const metadata: SessionMetadata = {
      sessionId: session.sessionId,
      serverTime: session.serverTime,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    }
    const previous = snapshot.session
    if (
      !started &&
      previous?.sessionId === session.sessionId &&
      Date.parse(previous.serverTime) > Date.parse(session.serverTime)
    )
      return
    snapshot = {
      session: metadata,
      clockOffset: Date.parse(session.serverTime) - Date.now(),
      reason: null,
      ended: false,
    }
    if (started) eventListeners.forEach((listener) => listener({ type: 'started' }))
    notify()
    if (broadcast) publish({ type: 'session', session: metadata, started })
  },
  end(reason: SessionEndReason = 'UNAUTHENTICATED', broadcast = true, markPending = true): void {
    const sessionId = snapshot.session?.sessionId ?? null
    if (reason === 'LOGOUT' && markPending && !getPendingLogout()) {
      pendingLogout = JSON.stringify({ sessionId, nonce: crypto.randomUUID() })
      try {
        localStorage.setItem(LOGOUT_KEY, pendingLogout)
      } catch {}
    }
    tokenStore.clear()
    snapshot = { session: null, clockOffset: 0, reason, ended: true }
    eventListeners.forEach((listener) => listener({ type: 'ended', reason }))
    notify()
    if (broadcast) publish({ type: 'ended', sessionId, reason })
  },
}

export const withAuthLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('company.auth.cookie', operation)
  }
  throw new Error(
    '이 브라우저는 안전한 로그인 동기화를 지원하지 않습니다. 최신 브라우저에서 다시 시도해 주세요.',
  )
}
