import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { baseApi, sessionStore, tokenStore } from '@/shared/api'
import { clearPendingLogout, getPendingLogout } from '@/shared/api/sessionStore'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { useAuthBootstrap } from './useAuthBootstrap'

const metadata = {
  sessionId: 'session-a',
  serverTime: new Date().toISOString(),
  idleExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  absoluteExpiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
}

describe('auth bootstrap', () => {
  beforeEach(() => {
    clearPendingLogout(getPendingLogout())
    localStorage.clear()
    sessionStore.end('UNAUTHENTICATED', false)
    sessionStore.beginLogin()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows retryable startup state for network failure and recovers', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse({ ...metadata, accessToken: 'new', expiresIn: 600 }))
    vi.stubGlobal('fetch', fetch)
    const { store, wrapper } = createTestWrapper()
    const { result } = renderHook(() => useAuthBootstrap(), { wrapper })
    await waitFor(() => expect(store.getState().auth.status).toBe('unavailable'))
    act(() => result.current.retry())
    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'))
    expect(tokenStore.get()).toBe('new')
  })

  it('clears global authentication and API cache for server expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ...metadata, accessToken: 'new', expiresIn: 600,
    })))
    const { store, wrapper } = createTestWrapper()
    renderHook(() => useAuthBootstrap(), { wrapper })
    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'))
    const cacheApi = baseApi.injectEndpoints({
      endpoints: (build) => ({ sessionTestData: build.query<unknown, void>({ query: () => '/session-test-data' }) }),
    })
    await store.dispatch(cacheApi.endpoints.sessionTestData.initiate())
    expect(Object.keys(store.getState().api.queries)).toHaveLength(1)
    act(() => sessionStore.end('SESSION_IDLE_EXPIRED', false))
    expect(store.getState().auth.status).toBe('anonymous')
    expect(tokenStore.get()).toBeNull()
    expect(store.getState().api.queries).toEqual({})
  })
})
