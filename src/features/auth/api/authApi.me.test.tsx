import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { useMeQuery } from './authApi'

const ME = {
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role: 'ADMIN',
  status: 'APPROVED',
}

describe('useMeQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('내 정보를 가져온다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ME)))
    const { wrapper } = createTestWrapper()

    const { result } = renderHook(() => useMeQuery(), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(ME))
  })

  // 헤더 조각들이 각자 부르므로 이게 성립하지 않으면 요청이 조각 수만큼 나간다
  it('여러 곳에서 불러도 요청은 한 번이다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ME))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = createTestWrapper()

    const { result } = renderHook(
      () => {
        useMeQuery()
        useMeQuery()
        return useMeQuery()
      },
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toEqual(ME))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // 승인 대기·거절 상태도 200 으로 온다. 403 이면 이유를 화면에 띄울 수 없다.
  it('REJECTED 상태도 그대로 받는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...ME, role: 'USER', status: 'REJECTED' })),
    )
    const { wrapper } = createTestWrapper()

    const { result } = renderHook(() => useMeQuery(), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('REJECTED'))
  })
})
