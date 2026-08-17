import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { UserApprovalList } from './UserApprovalList'

const ME = { id: 1, email: 'tiger@ibslab.com', name: '김성호', role: 'ADMIN', status: 'APPROVED' }

const row = (id: number, name: string) => ({
  id,
  name,
  email: `user${id}@ibslab.com`,
  status: 'PENDING',
  createdAt: '2026-08-17T14:22:00',
})

// me 와 목록 두 요청이 섞여 나가므로 URL 로 갈라준다
const stubFetch = (list: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url
      return Promise.resolve(url.includes('/users/me') ? jsonResponse(ME) : jsonResponse(list))
    }),
  )

describe('UserApprovalList', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('승인 대기 목록을 보여준다', async () => {
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })

    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())
    expect(screen.getByText(/user2@ibslab\.com/)).toBeInTheDocument()
  })

  // 백엔드가 CANNOT_REJECT_SELF 로 400 을 준다. 눌러서 에러를 보는 것보다 낫다.
  it('자기 자신의 거절 버튼은 비활성이다', async () => {
    stubFetch([row(1, '김성호'), row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })

    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    const rejectButtons = screen.getAllByRole('button', { name: '거절' })
    expect(rejectButtons[0]).toBeDisabled()
    expect(rejectButtons[1]).toBeEnabled()
  })

  it('비어 있으면 빈 표 대신 안내를 보여준다', async () => {
    stubFetch([])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText('승인 대기 중인 사람이 없습니다')).toBeInTheDocument(),
    )
  })

  it('탭 세 개가 있다', async () => {
    stubFetch([])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })

    expect(screen.getByRole('tab', { name: /승인 대기/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '승인됨' })).toBeInTheDocument()
    // 실수로 거절했을 때 되돌릴 유일한 통로다
    expect(screen.getByRole('tab', { name: '거절됨' })).toBeInTheDocument()
  })
})
