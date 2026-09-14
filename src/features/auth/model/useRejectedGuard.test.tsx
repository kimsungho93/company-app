import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '@/shared/api'
import { createTestWrapper, emptyResponse, jsonResponse } from '@/test/storeWrapper'
import { useRejectedGuard } from './useRejectedGuard'

const meWith = (status: string) => ({
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role: 'USER',
  status,
})

const stubFetch = (status: string) => {
  const fetchMock = vi.fn((input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/users/me')) return Promise.resolve(jsonResponse(meWith(status)))
    return Promise.resolve(emptyResponse(204))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const countOf = (mock: ReturnType<typeof stubFetch>, fragment: string) =>
  mock.mock.calls.filter(([sent]) => String((sent as Request)?.url ?? sent).includes(fragment))
    .length

describe('useRejectedGuard', () => {
  beforeEach(() => {
    tokenStore.set('live-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStore.clear()
  })

  it('세션 중 거절당하면 로그아웃시킨다', async () => {
    const fetchMock = stubFetch('REJECTED')
    const { wrapper } = createTestWrapper({ withRouter: true })

    renderHook(() => useRejectedGuard(), { wrapper })

    await waitFor(() => expect(countOf(fetchMock, '/auth/logout')).toBe(1))
    await waitFor(() => expect(tokenStore.get()).toBeNull())
  })

  it('상태가 그대로여도 로그아웃을 한 번만 쏜다', async () => {
    const fetchMock = stubFetch('REJECTED')
    const { wrapper } = createTestWrapper({ withRouter: true })

    renderHook(() => useRejectedGuard(), { wrapper })

    await waitFor(() => expect(countOf(fetchMock, '/auth/logout')).toBe(1))

    await waitFor(() => expect(countOf(fetchMock, '/users/me')).toBeGreaterThan(1))

    expect(countOf(fetchMock, '/auth/logout')).toBe(1)
  })

  it('승인된 사용자는 건드리지 않는다', async () => {
    const fetchMock = stubFetch('APPROVED')
    const { wrapper } = createTestWrapper({ withRouter: true })

    renderHook(() => useRejectedGuard(), { wrapper })

    await waitFor(() => expect(countOf(fetchMock, '/users/me')).toBe(1))
    expect(countOf(fetchMock, '/auth/logout')).toBe(0)
    expect(tokenStore.get()).toBe('live-token')
  })
})
