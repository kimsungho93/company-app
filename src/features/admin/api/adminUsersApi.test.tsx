import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, emptyResponse, jsonResponse } from '@/test/storeWrapper'
import { useAdminUsersQuery, useApproveUserMutation } from './adminUsersApi'

const PENDING = [
  {
    id: 2,
    email: 'younghee@ibslab.com',
    name: '이영희',
    status: 'PENDING',
    createdAt: '2026-08-17T14:22:00',
  },
]

describe('adminUsersApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('상태를 쿼리 파라미터로 넘겨 목록을 가져온다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PENDING))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = createTestWrapper()

    const { result } = renderHook(() => useAdminUsersQuery('PENDING'), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(PENDING))
    // fetchBaseQuery 는 Request 객체를 넘기지만, 문자열로 넘어와도 깨지지 않게 둔다
    const [sent] = fetchMock.mock.calls[0]
    expect(String(sent?.url ?? sent)).toContain('/admin/users?status=PENDING')
  })

  // 승인하면 목록에서 사라져야 한다. 태그를 안 걸면 화면이 그대로 남는다.
  it('승인하면 목록을 다시 가져온다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(PENDING))
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = createTestWrapper()

    const { result } = renderHook(
      () => ({
        list: useAdminUsersQuery('PENDING'),
        approve: useApproveUserMutation(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.list.data).toHaveLength(1))

    await act(async () => {
      await result.current.approve[0](2).unwrap()
    })

    await waitFor(() => expect(result.current.list.data).toHaveLength(0))
  })
})
