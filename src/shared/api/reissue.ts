import { API_BASE } from './apiBase'
import { clearPendingLogout, getPendingLogout, errorCode, sessionEndReasonFor, sessionStore, withAuthLock } from './sessionStore'
import { tokenStore } from './tokenStore'

export type ReissueResult = 'success' | 'terminal' | 'retryable' | 'cancelled'

let inflight: Promise<ReissueResult> | null = null

const call = async (generation: number): Promise<ReissueResult> => {
  const pending = getPendingLogout()
  if (pending) {
    try {
      const response = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(10_000) })
      if (response.ok) clearPendingLogout(pending)
    } catch {
      if (generation !== tokenStore.generation()) return 'cancelled'
      sessionStore.end('LOGOUT', false, false)
      return 'terminal'
    }
    if (generation !== tokenStore.generation()) return 'cancelled'
    sessionStore.end('LOGOUT', false, false)
    return 'terminal'
  }
  if (generation !== tokenStore.generation() || sessionStore.get().ended) return 'cancelled'
  try {
    const res = await fetch(`${API_BASE}/auth/reissue`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(10_000),
    })
    if (generation !== tokenStore.generation()) return 'cancelled'
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        const code = errorCode(await res.json().catch(() => null))
        if (generation !== tokenStore.generation()) return 'cancelled'
        sessionStore.end(sessionEndReasonFor(code))
        return 'terminal'
      }
      return 'retryable'
    }
    const body = await res.json()
    if (generation !== tokenStore.generation()) return 'cancelled'
    if (typeof body.accessToken !== 'string' || !body.accessToken) return 'retryable'
    tokenStore.set(body.accessToken)
    sessionStore.accept(body)
    return 'success'
  } catch {
    return generation !== tokenStore.generation() ? 'cancelled' : 'retryable'
  }
}

export const reissueSession = (): Promise<ReissueResult> => {
  sessionStore.initialize()
  if (!inflight) {
    const generation = tokenStore.generation()
    inflight = withAuthLock(() => call(generation)).catch((): ReissueResult => 'retryable').finally(() => { inflight = null })
  }
  return inflight
}

export const reissueOnce = async (): Promise<boolean> => (await reissueSession()) === 'success'
