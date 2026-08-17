import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, emptyResponse, jsonResponse } from '@/test/storeWrapper'
import { UserApprovalList } from './UserApprovalList'

const ME = { id: 1, email: 'tiger@ibslab.com', name: '김성호', role: 'ADMIN', status: 'APPROVED' }

const row = (id: number, name: string) => ({
  id,
  name,
  email: `user${id}@ibslab.com`,
  status: 'PENDING',
  // 백엔드는 Instant 를 UTC 로 내려준다. KST 로는 다음 날 07:11:11 이다.
  createdAt: '2026-08-17T22:11:11Z',
})

// me · 목록 · 승인/거절이 한 mock 으로 섞여 들어오므로 URL 로 갈라준다
const stubFetch = (list: unknown) => {
  const fetchMock = vi.fn((input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/users/me')) return Promise.resolve(jsonResponse(ME))
    if (url.includes('/approve') || url.includes('/reject')) {
      return Promise.resolve(emptyResponse(204))
    }
    return Promise.resolve(jsonResponse(list))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urlsOf = (mock: ReturnType<typeof stubFetch>) =>
  mock.mock.calls.map(([sent]) => String((sent as Request)?.url ?? sent))

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

  it('가입 시각을 초까지 한국 시간으로 보여준다', async () => {
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText(/2026-08-18 07:11:11/)).toBeInTheDocument(),
    )
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

  it('승인 버튼은 바로 실행하지 않고 확인을 묻는다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '승인' }))

    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(urlsOf(fetchMock).some((u) => u.includes('/approve'))).toBe(false)
  })

  it('확인하면 승인 요청이 나간다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '승인' }))
    // 목록의 '승인' 과 다이얼로그의 '승인' 이 둘 다 있으므로 다이얼로그 안에서 찾는다
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    await waitFor(() =>
      expect(urlsOf(fetchMock).some((u) => u.includes('/admin/users/2/approve'))).toBe(true),
    )
  })

  it('취소하면 아무 요청도 나가지 않는다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '거절' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
    expect(urlsOf(fetchMock).some((u) => u.includes('/reject'))).toBe(false)
  })

  it('체크한 사람만 일괄 승인한다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희'), row(3, '박철수')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '이영희 선택' }))
    await user.click(screen.getByRole('button', { name: '일괄 승인' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    await waitFor(() =>
      expect(urlsOf(fetchMock).some((u) => u.includes('/admin/users/2/approve'))).toBe(true),
    )
    expect(urlsOf(fetchMock).some((u) => u.includes('/admin/users/3/approve'))).toBe(false)
  })

  it('전체 선택으로 모두 고른다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희'), row(3, '박철수')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))
    expect(screen.getByText('2명 선택')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '일괄 승인' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('2명을 승인하시겠습니까?')

    await user.click(within(dialog).getByRole('button', { name: '승인' }))

    await waitFor(() =>
      expect(urlsOf(fetchMock).filter((u) => u.includes('/approve'))).toHaveLength(2),
    )
  })

  // 백엔드가 CANNOT_REJECT_SELF 로 400 을 준다. 일괄에서도 같은 규칙이다.
  it('본인이 선택에 들어 있으면 일괄 거절을 막고 이유를 알린다', async () => {
    const user = userEvent.setup()
    stubFetch([row(1, '김성호'), row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))

    expect(screen.getByRole('button', { name: '일괄 거절' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '일괄 승인' })).toBeEnabled()
    expect(screen.getByText('본인은 거절할 수 없습니다')).toBeInTheDocument()
  })

  // 남겨두면 다른 탭에서 고른 사람이 그대로 처리된다
  it('탭을 옮기면 선택이 비워진다', async () => {
    const user = userEvent.setup()
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '이영희 선택' }))
    expect(screen.getByText('1명 선택')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '승인됨' }))

    expect(screen.queryByText('1명 선택')).not.toBeInTheDocument()
  })

  it('일부가 실패하면 몇 명이 실패했는지 알린다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request | string) => {
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/users/me')) return Promise.resolve(jsonResponse(ME))
        if (url.includes('/admin/users/3/approve')) {
          return Promise.resolve(jsonResponse({ code: 'USER_NOT_FOUND' }, 404))
        }
        if (url.includes('/approve')) return Promise.resolve(emptyResponse(204))
        return Promise.resolve(jsonResponse([row(2, '이영희'), row(3, '박철수')]))
      }),
    )
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))
    await user.click(screen.getByRole('button', { name: '일괄 승인' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('2명 중 1명을 승인하지 못했습니다.'),
    )
  })

  // 거절은 사실상 그 주소를 영구 차단한다. 누르기 전에 알아야 한다.
  it('거절 확인창이 재가입 불가를 알린다', async () => {
    const user = userEvent.setup()
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '거절' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('거절하시겠습니까?')
    expect(dialog).toHaveTextContent(/다시 가입할 수 없어서/)
    expect(dialog).toHaveTextContent(/거절됨 탭에서 다시 승인/)
  })
})
