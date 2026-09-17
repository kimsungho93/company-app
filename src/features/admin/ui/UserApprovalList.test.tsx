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

  createdAt: '2026-08-17T22:11:11Z',
})

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

  it('조회 중에는 빈 목록이라고 안내하지 않는다', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
    const { wrapper } = createTestWrapper()
    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
    expect(screen.queryByText('승인 대기 중인 사람이 없습니다')).not.toBeInTheDocument()
  })

  it('조회 실패를 알리고 다시 시도하면 목록을 보여준다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ code: 'INTERNAL_ERROR', message: '목록 조회 실패' }, 500),
        )
        .mockResolvedValue(jsonResponse([row(2, '이영희')])),
    )
    const { wrapper } = createTestWrapper()
    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    expect(await screen.findByRole('alert')).toHaveTextContent('목록 조회 실패')
    expect(screen.queryByText('승인 대기 중인 사람이 없습니다')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByText('이영희')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('새 탭을 조회하는 동안 이전 탭의 사용자를 표시하지 않는다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request) => {
        if (input.url.includes('APPROVED')) return new Promise<Response>(() => {})
        return Promise.resolve(jsonResponse([row(2, '이영희')]))
      }),
    )
    const { wrapper } = createTestWrapper()
    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await screen.findByText('이영희')
    await user.click(screen.getByRole('tab', { name: '승인됨' }))
    expect(screen.queryByText('이영희')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  it('일괄 작업의 마지막 요청까지 확인창과 탭을 잠근다', async () => {
    const user = userEvent.setup()
    let finishLast!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request) => {
        if (input.url.includes('/2/approve'))
          return new Promise<Response>((resolve) => {
            finishLast = resolve
          })
        if (input.url.includes('/approve')) return Promise.resolve(emptyResponse(204))
        return Promise.resolve(jsonResponse([row(2, '이영희'), row(3, '박철수')]))
      }),
    )
    const { wrapper } = createTestWrapper()
    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await screen.findByText('이영희')
    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))
    await user.click(screen.getByRole('button', { name: '일괄 승인' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))
    await waitFor(() => expect(finishLast).toBeDefined())
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '승인됨' })).toBeDisabled()
    finishLast(emptyResponse(204))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('tab', { name: '승인됨' })).toBeEnabled()
  })

  it('승인 대기 목록을 보여준다', async () => {
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })

    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())
    expect(screen.getByText(/user2@ibslab\.com/)).toBeInTheDocument()
  })

  it('가입 시각을 초까지 한국 시간으로 보여준다', async () => {
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })

    await waitFor(() => expect(screen.getByText(/2026-08-18 07:11:11/)).toBeInTheDocument())
  })

  it('자기 자신의 거절 버튼은 비활성이다', async () => {
    stubFetch([row(1, '김성호'), row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })

    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    const rejectButtons = screen.getAllByRole('button', { name: '거절' })
    expect(rejectButtons[0]).toBeDisabled()
    expect(rejectButtons[1]).toBeEnabled()
  })

  it('비어 있으면 빈 표 대신 안내를 보여준다', async () => {
    stubFetch([])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText('승인 대기 중인 사람이 없습니다')).toBeInTheDocument(),
    )
  })

  it('탭 세 개가 있다', async () => {
    stubFetch([])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })

    expect(screen.getByRole('tab', { name: /승인 대기/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '승인됨' })).toBeInTheDocument()

    expect(screen.getByRole('tab', { name: '거절됨' })).toBeInTheDocument()
  })

  it('승인 버튼은 바로 실행하지 않고 확인을 묻는다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '승인' }))

    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(urlsOf(fetchMock).some((u) => u.includes('/approve'))).toBe(false)
  })

  it('확인하면 승인 요청이 나간다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '승인' }))

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    await waitFor(() =>
      expect(urlsOf(fetchMock).some((u) => u.includes('/admin/users/2/approve'))).toBe(true),
    )
  })

  it('취소하면 아무 요청도 나가지 않는다', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
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

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
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

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
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

  it('본인이 선택에 들어 있으면 일괄 거절을 막고 이유를 알린다', async () => {
    const user = userEvent.setup()
    stubFetch([row(1, '김성호'), row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))

    expect(screen.getByRole('button', { name: '일괄 거절' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '일괄 승인' })).toBeEnabled()
    expect(screen.getByText('본인은 거절할 수 없습니다')).toBeInTheDocument()
  })

  it('탭을 옮기면 선택이 비워진다', async () => {
    const user = userEvent.setup()
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '이영희 선택' }))
    expect(screen.getByText('1명 선택')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: '승인됨' }))

    expect(screen.queryByText('1명 선택')).not.toBeInTheDocument()
  })

  it('일부가 실패하면 실패한 사람과 사유를 짚어준다', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request | string) => {
        const url = typeof input === 'string' ? input : input.url
        if (url.includes('/users/me')) return Promise.resolve(jsonResponse(ME))
        if (url.includes('/admin/users/3/approve')) {
          return Promise.resolve(
            jsonResponse({ code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' }, 404),
          )
        }
        if (url.includes('/approve')) return Promise.resolve(emptyResponse(204))
        return Promise.resolve(jsonResponse([row(2, '이영희'), row(3, '박철수')]))
      }),
    )
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('checkbox', { name: '전체 선택' }))
    await user.click(screen.getByRole('button', { name: '일괄 승인' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '승인' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('1명을 승인했습니다. 1명은 처리하지 못했습니다.')
    expect(alert).toHaveTextContent('사용자를 찾을 수 없습니다. — 박철수')
  })

  it('거절 확인창이 재가입 불가를 알린다', async () => {
    const user = userEvent.setup()
    stubFetch([row(2, '이영희')])
    const { wrapper } = createTestWrapper()

    render(<UserApprovalList currentUserId={ME.id} />, { wrapper })
    await waitFor(() => expect(screen.getByText('이영희')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '거절' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('거절하시겠습니까?')
    expect(dialog).toHaveTextContent(/다시 가입할 수 없어서/)
    expect(dialog).toHaveTextContent(/거절됨 탭에서 다시 승인/)
  })
})
