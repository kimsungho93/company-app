import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class Channel {
  static channels: Channel[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  name: string
  constructor(name: string) { this.name = name; Channel.channels.push(this) }
  postMessage(data: unknown) {
    for (const other of Channel.channels) {
      if (other !== this && other.name === this.name) other.onmessage?.({ data } as MessageEvent)
    }
  }
}

const session = (sessionId = 'session-a', extra = {}) => ({
  sessionId,
  serverTime: '2030-01-01T00:00:00Z',
  idleExpiresAt: '2030-01-01T00:30:00Z',
  absoluteExpiresAt: '2030-01-01T08:00:00Z',
  ...extra,
})

const tab = async () => {
  vi.resetModules()
  const { sessionStore } = await import('./sessionStore')
  const { tokenStore } = await import('./tokenStore')
  sessionStore.initialize()
  return { sessionStore, tokenStore }
}

describe('session synchronization between tabs', () => {
  beforeEach(() => {
    localStorage.clear()
    Channel.channels = []
    vi.stubGlobal('BroadcastChannel', Channel)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shares deadlines and logout without exposing access tokens', async () => {
    const a = await tab()
    const b = await tab()
    a.tokenStore.set('secret-a')
    a.sessionStore.accept(session(), true)
    b.tokenStore.set('secret-b')
    const updated = session('session-a', { serverTime: '2030-01-01T00:01:00Z', idleExpiresAt: '2030-01-01T00:31:00Z' })
    a.sessionStore.accept(updated)
    expect(b.sessionStore.get().session).toEqual(updated)
    expect(b.tokenStore.get()).toBe('secret-b')
    a.sessionStore.end('LOGOUT')
    expect(b.sessionStore.get().reason).toBe('LOGOUT')
    expect(b.tokenStore.get()).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain('secret')
  })

  it('does not apply a delayed logout from an old session to a new login', async () => {
    const a = await tab()
    const b = await tab()
    a.sessionStore.accept(session(), true)
    b.sessionStore.accept(session('session-b'), true)
    Channel.channels[0].postMessage({ type: 'ended', sessionId: 'session-a', reason: 'LOGOUT' })
    expect(b.sessionStore.get().session?.sessionId).toBe('session-b')
    expect(b.sessionStore.get().ended).toBe(false)
  })

  it('does not resurrect an ended session with a late activity broadcast', async () => {
    const a = await tab()
    const b = await tab()
    a.sessionStore.accept(session(), true)
    a.sessionStore.end('SESSION_REVOKED')
    Channel.channels[0].postMessage({ type: 'session', session: session(), started: false })
    expect(b.sessionStore.get().ended).toBe(true)
    expect(b.sessionStore.get().session).toBeNull()
  })
})
