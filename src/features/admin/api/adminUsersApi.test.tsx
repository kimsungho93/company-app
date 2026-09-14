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

    const [sent] = fetchMock.mock.calls[0]
    expect(String(sent?.url ?? sent)).toContain('/admin/users?status=PENDING')
  })

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
