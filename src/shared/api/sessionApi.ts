import { API_BASE } from './apiBase'
import { reissueSession } from './reissue'
import {
  errorCode,
  isSessionEndCode,
  isSessionMetadata,
  sessionEndReasonFor,
  sessionStore,
} from './sessionStore'
import { tokenStore } from './tokenStore'

export type SessionRequestResult = 'success' | 'terminal' | 'retryable' | 'cancelled'

const request = async (activity: boolean, retry = true): Promise<SessionRequestResult> => {
  const generation = tokenStore.generation()
  if (sessionStore.get().ended) return 'cancelled'
  try {
    const token = tokenStore.get()
    const response = await fetch(`${API_BASE}/auth/session${activity ? '/activity' : ''}`, {
      method: activity ? 'POST' : 'GET',
      credentials: 'include',
      signal: AbortSignal.timeout(10_000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    })
    if (generation !== tokenStore.generation()) return 'cancelled'
    const body: unknown = await response.json().catch(() => null)
    if (generation !== tokenStore.generation()) return 'cancelled'
    if (response.ok && isSessionMetadata(body)) {
      sessionStore.accept(body)
      return 'success'
    }
    if (response.status === 401) {
      const code = errorCode(body)
      if (isSessionEndCode(code)) {
        sessionStore.end(code)
        return 'terminal'
      }
      if (retry) {
        const refreshed = await reissueSession()
        return refreshed === 'success' ? request(activity, false) : refreshed
      }
      sessionStore.end(sessionEndReasonFor(code))
      return 'terminal'
    }
    return 'retryable'
  } catch {
    return generation !== tokenStore.generation() ? 'cancelled' : 'retryable'
  }
}

let statusRequest: Promise<SessionRequestResult> | null = null
let activityRequest: Promise<SessionRequestResult> | null = null

export const checkSession = (): Promise<SessionRequestResult> => {
  statusRequest ??= request(false).finally(() => {
    statusRequest = null
  })
  return statusRequest
}

export const reportActivity = (): Promise<SessionRequestResult> => {
  activityRequest ??= request(true).finally(() => {
    activityRequest = null
  })
  return activityRequest
}
