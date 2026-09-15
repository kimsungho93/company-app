import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reissueSession } from './reissue'
import { checkSession, reportActivity } from './sessionApi'
import { clearPendingLogout, getPendingLogout, sessionStore, withAuthLock } from './sessionStore'
import { tokenStore } from './tokenStore'

const metadata = (changes = {}) => ({
  sessionId: 'session-a',
  serverTime: new Date().toISOString(),
  idleExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  absoluteExpiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
  ...changes,
})
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('session security', () => {
  beforeEach(() => {
    clearPendingLogout(getPendingLogout())
    localStorage.clear()
    sessionStore.end('UNAUTHENTICATED', false)
    sessionStore.beginLogin()
    sessionStore.accept(metadata(), true, false)
    tokenStore.set('current-token')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    clearPendingLogout(getPendingLogout())
  })

  it.each([500, 503, 429])('preserves login after retryable HTTP %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)))
    await expect(reissueSession()).resolves.toBe('retryable')
    expect(tokenStore.get()).toBe('current-token')
    expect(sessionStore.get().ended).toBe(false)
  })

  it('preserves login after a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(reissueSession()).resolves.toBe('retryable')
    expect(tokenStore.get()).toBe('current-token')
    expect(sessionStore.get().session?.sessionId).toBe('session-a')
  })

  it.each(['SESSION_IDLE_EXPIRED', 'SESSION_ABSOLUTE_EXPIRED', 'SESSION_REVOKED'])(
    'ends the session for %s without requesting activity',
    async (code) => {
      const fetch = vi.fn().mockResolvedValue(response({ code }, 401))
      vi.stubGlobal('fetch', fetch)
      await expect(reissueSession()).resolves.toBe('terminal')
      expect(tokenStore.get()).toBeNull()
      expect(sessionStore.get().reason).toBe(code)
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )

  it('preserves the absolute expiry reason when the capped refresh cookie is already gone', async () => {
    sessionStore.accept(metadata({ absoluteExpiresAt: new Date(Date.now() - 1_000).toISOString() }), true, false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ code: 'UNAUTHENTICATED' }, 401)))
    await expect(reissueSession()).resolves.toBe('terminal')
    expect(sessionStore.get().reason).toBe('SESSION_ABSOLUTE_EXPIRED')
    expect(tokenStore.get()).toBeNull()
  })

  it('does not infer expiry from a temporary network failure after the deadline', async () => {
    sessionStore.accept(metadata({ absoluteExpiresAt: new Date(Date.now() - 1_000).toISOString() }), true, false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(reissueSession()).resolves.toBe('retryable')
    expect(sessionStore.get().ended).toBe(false)
    expect(sessionStore.get().reason).toBeNull()
  })

  it('discards a refresh success arriving after logout', async () => {
    const pending = deferred<Response>()
    const fetch = vi.fn().mockReturnValue(pending.promise)
    vi.stubGlobal('fetch', fetch)
    const refresh = reissueSession()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    sessionStore.end('LOGOUT', false)
    pending.resolve(response({ ...metadata(), accessToken: 'late-token', expiresIn: 600 }))
    await expect(refresh).resolves.toBe('cancelled')
    expect(tokenStore.get()).toBeNull()
    expect(sessionStore.get().ended).toBe(true)
  })

  it('retains the original absolute deadline when refreshing', async () => {
    const session = metadata()
    sessionStore.accept(session, true, false)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...session, accessToken: 'new', expiresIn: 600 })))
    await expect(reissueSession()).resolves.toBe('success')
    expect(sessionStore.get().session).toEqual(session)
    expect(localStorage.length).toBe(0)
  })

  it('checks status without extending activity', async () => {
    const fetch = vi.fn().mockResolvedValue(response(metadata()))
    vi.stubGlobal('fetch', fetch)
    await expect(checkSession()).resolves.toBe('success')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/session$/), expect.objectContaining({
      method: 'GET', headers: { Authorization: 'Bearer current-token' },
    }))
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('reports explicit activity without sending client timestamps', async () => {
    const fetch = vi.fn().mockResolvedValue(response(metadata()))
    vi.stubGlobal('fetch', fetch)
    await expect(reportActivity()).resolves.toBe('success')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/session\/activity$/), expect.objectContaining({ method: 'POST' }))
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('body')
  })

  it('does not revive an expired session through activity', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ code: 'SESSION_IDLE_EXPIRED' }, 401))
    vi.stubGlobal('fetch', fetch)
    await expect(reportActivity()).resolves.toBe('terminal')
    expect(sessionStore.get().reason).toBe('SESSION_IDLE_EXPIRED')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('refreshes only once for an expired access token before reading status', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ code: 'TOKEN_EXPIRED' }, 401))
      .mockResolvedValueOnce(response({ ...metadata(), accessToken: 'new', expiresIn: 600 }))
      .mockResolvedValueOnce(response(metadata()))
    vi.stubGlobal('fetch', fetch)
    await expect(checkSession()).resolves.toBe('success')
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/session$/),
      expect.stringMatching(/\/reissue$/),
      expect.stringMatching(/\/session$/),
    ])
  })

  it('serializes cookie mutations with the same browser lock', async () => {
    const first = deferred<void>()
    const order: string[] = []
    const a = withAuthLock(async () => { order.push('refresh'); await first.promise; order.push('refreshed') })
    const b = withAuthLock(async () => { order.push('logout') })
    await vi.waitFor(() => expect(order).toEqual(['refresh']))
    first.resolve()
    await Promise.all([a, b])
    expect(order).toEqual(['refresh', 'refreshed', 'logout'])
  })

  it('refuses unlocked refresh when Web Locks is unavailable', async () => {
    const locks = navigator.locks
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      await expect(reissueSession()).resolves.toBe('retryable')
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: locks })
    }
  })

  it('retries a pending logout before bootstrap and never reissues its cookie', async () => {
    sessionStore.end('LOGOUT', false)
    expect(getPendingLogout()).not.toBeNull()
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await expect(reissueSession()).resolves.toBe('terminal')
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/logout$/), expect.anything())
    expect(fetch).toHaveBeenCalledOnce()
    expect(getPendingLogout()).toBeNull()
    expect(tokenStore.get()).toBeNull()
  })

  it('keeps the pending logout when the network is unavailable', async () => {
    sessionStore.end('LOGOUT', false)
    const marker = getPendingLogout()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(reissueSession()).resolves.toBe('terminal')
    expect(getPendingLogout()).toBe(marker)
    expect(sessionStore.get().ended).toBe(true)
  })

  it('ignores a network failure that arrives after logout', async () => {
    let reject!: (error: Error) => void
    const fetch = vi.fn().mockReturnValue(new Promise<Response>((_resolve, fail) => { reject = fail }))
    vi.stubGlobal('fetch', fetch)
    const old = reissueSession()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    sessionStore.end('LOGOUT', false)
    reject(new TypeError('offline'))
    await expect(old).resolves.toBe('cancelled')
    expect(sessionStore.get().reason).toBe('LOGOUT')
  })

  it('ignores an expiry body parsed after a new login starts', async () => {
    const parsed = deferred<unknown>()
    const json = vi.fn().mockReturnValue(parsed.promise)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json }))
    const old = reissueSession()
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce())
    sessionStore.beginLogin()
    sessionStore.accept(metadata({ sessionId: 'new-session' }), true, false)
    tokenStore.set('new-login-token')
    parsed.resolve({ code: 'SESSION_REVOKED' })
    await expect(old).resolves.toBe('cancelled')
    expect(tokenStore.get()).toBe('new-login-token')
    expect(sessionStore.get().ended).toBe(false)
  })

  it('ignores an activity body parsed after logout', async () => {
    const parsed = deferred<unknown>()
    const json = vi.fn().mockReturnValue(parsed.promise)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json }))
    const old = reportActivity()
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce())
    sessionStore.end('LOGOUT', false)
    parsed.resolve(metadata())
    await expect(old).resolves.toBe('cancelled')
    expect(sessionStore.get().ended).toBe(true)
    expect(sessionStore.get().session).toBeNull()
  })

  it('ignores older server snapshots delivered after a newer activity response', () => {
    const newer = metadata({ serverTime: '2030-01-01T00:10:00Z', idleExpiresAt: '2030-01-01T00:40:00Z' })
    sessionStore.accept(newer)
    sessionStore.accept(metadata({ serverTime: '2030-01-01T00:09:00Z', idleExpiresAt: '2030-01-01T00:39:00Z' }))
    expect(sessionStore.get().session).toEqual(newer)
  })
})
