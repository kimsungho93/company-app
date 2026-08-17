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

const calledLogout = (mock: ReturnType<typeof stubFetch>) =>
  mock.mock.calls.some(([sent]) => String((sent as Request)?.url ?? sent).includes('/auth/logout'))

describe('useRejectedGuard', () => {
  beforeEach(() => {
    tokenStore.set('live-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStore.clear()
  })

  // 거절해도 access token 은 무효화되지 않아 최대 30분 살아 있다.
  // 이 브라우저에서만이라도 끊는다.
  it('세션 중 거절당하면 로그아웃시킨다', async () => {
    const fetchMock = stubFetch('REJECTED')
    const { wrapper } = createTestWrapper({ withRouter: true })

    renderHook(() => useRejectedGuard(), { wrapper })

    await waitFor(() => expect(calledLogout(fetchMock)).toBe(true))
    await waitFor(() => expect(tokenStore.get()).toBeNull())
  })

  it('승인된 사용자는 건드리지 않는다', async () => {
    const fetchMock = stubFetch('APPROVED')
    const { wrapper } = createTestWrapper({ withRouter: true })

    renderHook(() => useRejectedGuard(), { wrapper })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(calledLogout(fetchMock)).toBe(false)
    expect(tokenStore.get()).toBe('live-token')
  })
})
