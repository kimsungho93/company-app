import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper } from '@/test/storeWrapper'
import type { Holiday, LeaveEntry } from '../model/types'
import { LeaveCalendar } from './LeaveCalendar'

const FIXED_TODAY = new Date(2026, 7, 18, 10, 0, 0)

const ME = { id: 1, name: '김성호' }

const LEAVES: LeaveEntry[] = [
  { id: 1, userId: 1, name: '김성호', kind: 'ANNUAL', startDate: '2026-08-13', endDate: '2026-08-14' },
  { id: 2, userId: 2, name: '이영희', kind: 'HALF_DAY_AM', startDate: '2026-08-14', endDate: '2026-08-14' },
  { id: 3, userId: 3, name: '박철수', kind: 'ANNUAL', startDate: '2026-08-18', endDate: '2026-08-21' },
  { id: 4, userId: 4, name: '오세훈', kind: 'HALF_DAY_PM', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 5, userId: 2, name: '이영희', kind: 'HALF_DAY_AM', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 6, userId: 5, name: '최민수', kind: 'ANNUAL', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 7, userId: 6, name: '윤서준', kind: 'OFFICIAL', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 8, userId: 7, name: '한지우', kind: 'ANNUAL', startDate: '2026-08-31', endDate: '2026-09-04' },
]

interface Call {
  url: string
  method: string
  body: unknown
}

interface StubOptions {
  leaves?: LeaveEntry[]
  holidays?: Holiday[]
  fail?: Record<string, [number, unknown]>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stubApi = ({ leaves = LEAVES, holidays = [], fail = {} }: StubOptions = {}) => {
  const calls: Call[] = []
  const leaveRows = [...leaves]
  const holidayRows = [...holidays]
  let nextId = 100

  const idFrom = (url: string) => Number(url.split('/').pop())

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const request = input as Request
      const url = typeof input === 'string' ? input : request.url
      const method = init?.method ?? request.method ?? 'GET'

      const raw =
        typeof init?.body === 'string' ? init.body : method === 'GET' ? '' : await request.text()
      const body = raw ? JSON.parse(raw) : null
      calls.push({ url, method, body })

      for (const [path, [status, failBody]] of Object.entries(fail)) {
        if (url.includes(path) && method !== 'GET') return json(failBody, status)
      }

      const rows = url.includes('/holidays') ? holidayRows : leaveRows
      if (!url.includes('/holidays') && !url.includes('/leaves')) return json({}, 404)

      if (method === 'GET') return json(rows)

      if (method === 'DELETE') {
        const index = rows.findIndex((row) => row.id === idFrom(url))
        if (index >= 0) rows.splice(index, 1)
        return new Response(null, { status: 204 })
      }

      const created = url.includes('/holidays')
        ? { id: nextId++, ...body }
        : { id: nextId++, userId: ME.id, name: ME.name, ...body }
      rows.push(created)
      return json(created, 201)
    }),
  )

  return calls
}

const lastCall = (calls: Call[], path: string, method: string) =>
  [...calls].reverse().find((call) => call.url.includes(path) && call.method === method)

describe('LeaveCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const setup = (props: { userName?: string; userId?: number; isAdmin?: boolean } = {}) => {
    const { wrapper } = createTestWrapper()
    return { user: userEvent.setup(), ...render(<LeaveCalendar {...props} />, { wrapper }) }
  }

  const asMe = (extra: { isAdmin?: boolean } = {}) =>
    setup({ userName: ME.name, userId: ME.id, ...extra })

  it('오늘이 속한 달을 보여준다', () => {
    stubApi()
    setup()

    expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()
  })

  it('요일 머리글이 일요일부터 있다', () => {
    stubApi()
    setup()

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      '일',
      '월',
      '화',
      '수',
      '목',
      '금',
      '토',
    ])
  })

  it('오늘 칸을 표시한다', () => {
    stubApi()
    setup()
    const today = document.querySelector('[aria-current="date"]')

    expect(within(today as HTMLElement).getByText('18')).toBeInTheDocument()
  })

  it('6주 격자의 양끝으로 조회한다', async () => {
    const calls = stubApi()
    setup()

    await waitFor(() => expect(lastCall(calls, '/leaves', 'GET')).toBeDefined())

    expect(lastCall(calls, '/leaves', 'GET')?.url).toContain('from=2026-07-26&to=2026-09-05')
    expect(lastCall(calls, '/holidays', 'GET')?.url).toContain('from=2026-07-26&to=2026-09-05')
  })

  it('여러 날에 걸친 휴가를 매일 표시한다', async () => {
    stubApi()
    setup()

    await waitFor(() => expect(screen.getAllByText('박철수')).toHaveLength(4))
  })

  it('달을 걸친 휴가가 양쪽 달에 나온다', async () => {
    const { user } = setup()
    stubApi()
    await waitFor(() => expect(screen.getAllByText('한지우').length).toBeGreaterThan(0))

    await user.click(screen.getByRole('button', { name: '다음 달' }))

    await waitFor(() => expect(screen.getAllByText('한지우').length).toBeGreaterThan(0))
  })

  it('공휴일 이름을 칸에 적는다', () => {
    stubApi()
    setup()

    expect(screen.getByText('광복절')).toBeInTheDocument()
  })

  it('서버가 지정한 공휴일도 칸에 적는다', async () => {
    stubApi({
      holidays: [{ id: 1, name: '창립기념일', startDate: '2026-08-26', endDate: '2026-08-28' }],
    })
    setup()

    await waitFor(() => expect(screen.getAllByText('창립기념일')).toHaveLength(3))
  })

  it('조회가 실패하면 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'INTERNAL_ERROR', message: '서버에 문제가 발생했습니다.' }, 500)))
    setup()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('서버에 문제가 발생했습니다.'),
    )
  })

  describe('연·월 고르기', () => {
    it('제목을 누르면 12개월이 나온다', async () => {
      stubApi()
      const { user } = setup()

      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      expect(screen.getByRole('button', { name: '1월' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '12월' })).toBeInTheDocument()
    })

    it('달을 고르면 그 달로 옮기고 닫힌다', async () => {
      stubApi()
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '11월' }))

      expect(screen.getByRole('heading', { name: '2026년 11월' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
    })

    it('연도를 넘겨도 고르기 전에는 달력이 그대로다', async () => {
      stubApi()
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '다음 연도' }))
      expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '3월' }))
      expect(screen.getByRole('heading', { name: '2027년 3월' })).toBeInTheDocument()
    })

    it('바깥을 누르면 닫힌다', async () => {
      stubApi()
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '오늘' }))

      expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
    })
  })

  it('칸에는 3명까지만 그리고 나머지는 수로 적는다', async () => {
    stubApi()
    setup()

    const trigger = await screen.findByRole('button', { name: '8월 19일 수요일 휴가 5명' })
    const cell = trigger.closest('td') as HTMLElement

    expect(within(cell).getAllByRole('listitem')).toHaveLength(3)
    expect(within(cell).getByText('+2명')).toBeInTheDocument()
  })

  describe('날짜 팝업', () => {
    const EMPTY_DAY = '8월 26일 수요일 휴가 0명'
    const SHARED_DAY = '8월 14일 금요일 휴가 2명'

    const open = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(await screen.findByRole('button', { name }))
      return screen.getByRole('dialog')
    }

    it('칸을 누르면 그날 팝업이 열린다', async () => {
      stubApi()
      const { user } = asMe()

      const dialog = await open(user, SHARED_DAY)

      expect(within(dialog).getByRole('heading', { name: '8월 14일 금요일' })).toBeInTheDocument()
      expect(within(dialog).getByText('이영희')).toBeInTheDocument()
    })

    it('접힌 인원도 팝업에서는 다 보인다', async () => {
      stubApi()
      const { user } = setup()

      const dialog = await open(user, '8월 19일 수요일 휴가 5명')

      expect(within(within(dialog).getByRole('list')).getAllByRole('listitem')).toHaveLength(5)
      expect(within(dialog).getByText('윤서준')).toBeInTheDocument()
    })

    it('여러 날에 걸친 휴가는 기간을 적는다', async () => {
      stubApi()
      const { user } = setup()

      const dialog = await open(user, SHARED_DAY)

      expect(within(dialog).getByText('연차 · 8/13–8/14')).toBeInTheDocument()
    })

    it('닫으면 눌렀던 칸으로 포커스가 돌아온다', async () => {
      stubApi()
      const { user } = setup()
      const trigger = await screen.findByRole('button', { name: EMPTY_DAY })
      await user.click(trigger)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }))

      expect(trigger).toHaveFocus()
    })

    describe('등록', () => {
      it('고른 종류를 코드로 보내고 팝업이 닫힌다', async () => {
        const calls = stubApi()
        const { user } = asMe()
        const dialog = await open(user, EMPTY_DAY)

        await user.click(within(dialog).getByRole('radio', { name: '공가' }))
        await user.click(within(dialog).getByRole('button', { name: '등록' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(lastCall(calls, '/leaves', 'POST')?.body).toEqual({
          kind: 'OFFICIAL',
          startDate: '2026-08-26',
          endDate: '2026-08-26',
        })
      })

      it('반차가 아니면 종료일 칸이 있다', async () => {
        stubApi()
        const { user } = asMe()
        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByLabelText('종료일')).toBeInTheDocument()

        await user.click(within(dialog).getByRole('radio', { name: '오전반차' }))
        expect(within(dialog).queryByLabelText('종료일')).not.toBeInTheDocument()

        await user.click(within(dialog).getByRole('radio', { name: '공가' }))
        expect(within(dialog).getByLabelText('종료일')).toBeInTheDocument()
      })

      it('겹치면 서버가 준 문구를 띄우고 팝업이 남는다', async () => {
        stubApi({
          fail: {
            '/leaves': [409, { code: 'LEAVE_OVERLAP', message: '8월 13일부터 연차가 이미 있습니다.' }],
          },
        })
        const { user } = asMe()
        const dialog = await open(user, SHARED_DAY)

        await user.click(within(dialog).getByRole('button', { name: '등록' }))

        await waitFor(() =>
          expect(within(dialog).getByRole('alert')).toHaveTextContent(
            '8월 13일부터 연차가 이미 있습니다.',
          ),
        )
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      it('me 를 모르면 등록하지 못한다', async () => {
        stubApi()
        const { user } = setup()

        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByRole('button', { name: '등록' })).toBeDisabled()
      })
    })

    describe('삭제', () => {
      it('userId 가 같은 휴가에만 삭제 버튼이 있다', async () => {
        stubApi()
        const { user } = asMe()

        const list = within(await open(user, SHARED_DAY)).getByRole('list')

        expect(within(list).getByRole('button', { name: '김성호 연차 삭제' })).toBeInTheDocument()
        expect(within(list).queryByRole('button', { name: /이영희/ })).not.toBeInTheDocument()
      })

      it('확인창에서 삭제하면 그 휴가를 지운다', async () => {
        const calls = stubApi()
        const { user } = asMe()
        const dialog = await open(user, SHARED_DAY)
        await user.click(within(dialog).getByRole('button', { name: '김성호 연차 삭제' }))

        await user.click(screen.getByRole('button', { name: '삭제' }))

        await waitFor(() => expect(lastCall(calls, '/leaves/1', 'DELETE')).toBeDefined())
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    describe('공휴일 지정', () => {
      it('관리자가 아니면 공휴일 칸이 없다', async () => {
        stubApi()
        const { user } = asMe()

        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).queryByLabelText('공휴일 이름')).not.toBeInTheDocument()
      })

      it('관리자가 지정하면 연휴 기간으로 보낸다', async () => {
        const calls = stubApi()
        const { user } = asMe({ isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)

        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.clear(within(dialog).getByLabelText('공휴일 종료일'))
        await user.type(within(dialog).getByLabelText('공휴일 종료일'), '2026-08-28')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        await waitFor(() => expect(lastCall(calls, '/holidays', 'POST')).toBeDefined())
        expect(lastCall(calls, '/holidays', 'POST')?.body).toEqual({
          name: '창립기념일',
          startDate: '2026-08-26',
          endDate: '2026-08-28',
        })
      })

      it('해제하면 입력칸이 비어 있다', async () => {
        stubApi()
        const { user } = asMe({ isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)
        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        await user.click(await within(dialog).findByRole('button', { name: '해제' }))

        expect(await within(dialog).findByLabelText('공휴일 이름')).toHaveValue('')
      })

      it('지정된 공휴일은 해제할 수 있다', async () => {
        const calls = stubApi({
          holidays: [{ id: 9, name: '창립기념일', startDate: '2026-08-26', endDate: '2026-08-26' }],
        })
        const { user } = asMe({ isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)

        await user.click(await within(dialog).findByRole('button', { name: '해제' }))

        await waitFor(() => expect(lastCall(calls, '/holidays/9', 'DELETE')).toBeDefined())
      })

      it('법정공휴일은 고칠 수 없다', async () => {
        stubApi()
        const { user } = asMe({ isAdmin: true })

        const dialog = await open(user, '8월 15일 토요일 휴가 0명')

        expect(within(dialog).getByText('법정공휴일')).toBeInTheDocument()
        expect(within(dialog).queryByLabelText('공휴일 이름')).not.toBeInTheDocument()
      })

      it('이름이 비면 지정할 수 없다', async () => {
        stubApi()
        const { user } = asMe({ isAdmin: true })

        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByRole('button', { name: '지정' })).toBeDisabled()
      })
    })
  })
})
