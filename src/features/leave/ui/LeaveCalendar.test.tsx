import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeaveEntry } from '../model/types'
import { LeaveCalendar } from './LeaveCalendar'

const FIXED_TODAY = new Date(2026, 7, 18, 10, 0, 0)

const LEAVES: LeaveEntry[] = [
  { id: 1, name: '김성호', kind: '연차', startDate: '2026-08-13', endDate: '2026-08-14' },
  { id: 2, name: '이영희', kind: '오전반차', startDate: '2026-08-14', endDate: '2026-08-14' },
  { id: 3, name: '박철수', kind: '연차', startDate: '2026-08-18', endDate: '2026-08-21' },
  { id: 4, name: '오세훈', kind: '오후반차', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 5, name: '이영희', kind: '오전반차', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 6, name: '최민수', kind: '연차', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 7, name: '윤서준', kind: '공가', startDate: '2026-08-19', endDate: '2026-08-19' },
  { id: 8, name: '한지우', kind: '연차', startDate: '2026-08-31', endDate: '2026-09-04' },
]

describe('LeaveCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(FIXED_TODAY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const setup = (props: { userName?: string; isAdmin?: boolean } = {}) => ({
    user: userEvent.setup(),
    ...render(<LeaveCalendar initialEntries={LEAVES} {...props} />),
  })

  it('아무것도 주지 않으면 빈 달력이다', () => {
    render(<LeaveCalendar />)

    expect(within(screen.getByRole('table')).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('오늘이 속한 달을 보여준다', () => {
    setup()

    expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()
  })

  it('요일 머리글이 일요일부터 있다', () => {
    setup()
    const headers = screen.getAllByRole('columnheader')

    expect(headers.map((h) => h.textContent)).toEqual(['일', '월', '화', '수', '목', '금', '토'])
  })

  it('오늘 칸을 표시한다', () => {
    setup()
    const today = document.querySelector('[aria-current="date"]')

    expect(today).not.toBeNull()
    expect(within(today as HTMLElement).getByText('18')).toBeInTheDocument()
  })

  it('여러 날에 걸친 휴가를 매일 표시한다', () => {
    setup()

    expect(screen.getAllByText('박철수')).toHaveLength(4)
  })

  it('이전·다음 달로 옮길 수 있다', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByRole('heading', { name: '2026년 7월' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음 달' }))
    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByRole('heading', { name: '2026년 9월' })).toBeInTheDocument()
  })

  it('달을 걸친 휴가가 양쪽 달에 나온다', async () => {
    const { user } = setup()
    expect(screen.getAllByText('한지우').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '다음 달' }))

    expect(screen.getAllByText('한지우').length).toBeGreaterThan(0)
  })

  it('공휴일 이름을 칸에 적는다', () => {
    setup()

    expect(screen.getByText('광복절')).toBeInTheDocument()
  })

  describe('연·월 고르기', () => {
    it('제목을 누르면 12개월이 나온다', async () => {
      const { user } = setup()

      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      expect(screen.getByRole('button', { name: '1월' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '12월' })).toBeInTheDocument()
    })

    it('달을 고르면 그 달로 옮기고 닫힌다', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '11월' }))

      expect(screen.getByRole('heading', { name: '2026년 11월' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
    })

    it('연도를 넘겨도 고르기 전에는 달력이 그대로다', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '다음 연도' }))
      expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '3월' }))
      expect(screen.getByRole('heading', { name: '2027년 3월' })).toBeInTheDocument()
    })

    it('바깥을 누르면 닫힌다', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('button', { name: '2026년 8월' }))

      await user.click(screen.getByRole('button', { name: '오늘' }))

      expect(screen.queryByRole('button', { name: '1월' })).not.toBeInTheDocument()
    })
  })

  it('오늘 버튼으로 돌아온다', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '이전 달' }))

    await user.click(screen.getByRole('button', { name: '오늘' }))

    expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()
  })

  describe('한 날에 인원이 많을 때', () => {
    it('칸에는 3명까지만 그리고 나머지는 수로 적는다', () => {
      setup()
      const cell = screen
        .getByRole('button', { name: '8월 19일 수요일 휴가 5명' })
        .closest('td') as HTMLElement

      expect(within(cell).getAllByRole('listitem')).toHaveLength(3)
      expect(within(cell).getByText('+2명')).toBeInTheDocument()
    })
  })

  describe('날짜 팝업', () => {
    const EMPTY_DAY = '8월 26일 수요일 휴가 0명'
    const SHARED_DAY = '8월 14일 금요일 휴가 2명'

    const open = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      await user.click(screen.getByRole('button', { name }))
      return screen.getByRole('dialog')
    }

    it('칸을 누르면 그날 팝업이 열린다', async () => {
      const { user } = setup({ userName: '김성호' })

      const dialog = await open(user, SHARED_DAY)

      expect(within(dialog).getByRole('heading', { name: '8월 14일 금요일' })).toBeInTheDocument()
      expect(within(dialog).getByText('이영희')).toBeInTheDocument()
    })

    it('접힌 인원도 팝업에서는 다 보인다', async () => {
      const { user } = setup()

      const dialog = await open(user, '8월 19일 수요일 휴가 5명')

      expect(within(dialog).getByRole('list')).toBeInTheDocument()
      expect(within(within(dialog).getByRole('list')).getAllByRole('listitem')).toHaveLength(5)
      expect(within(dialog).getByText('윤서준')).toBeInTheDocument()
    })

    it('여러 날에 걸친 휴가는 기간을 적는다', async () => {
      const { user } = setup()

      const dialog = await open(user, SHARED_DAY)

      expect(within(dialog).getByText('연차 · 8/13–8/14')).toBeInTheDocument()
    })

    it('빈 날에는 쉬는 사람이 없다고 적는다', async () => {
      const { user } = setup({ userName: '김성호' })

      const dialog = await open(user, EMPTY_DAY)

      expect(within(dialog).getByText('쉬는 사람이 없습니다.')).toBeInTheDocument()
    })

    it('닫으면 눌렀던 칸으로 포커스가 돌아온다', async () => {
      const { user } = setup()
      const trigger = screen.getByRole('button', { name: EMPTY_DAY })
      await user.click(trigger)

      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }))

      expect(trigger).toHaveFocus()
    })

    describe('등록', () => {
      it('종류를 고르고 등록하면 팝업이 닫히고 칸에 나타난다', async () => {
        const { user } = setup({ userName: '김성호' })
        const dialog = await open(user, EMPTY_DAY)

        await user.click(within(dialog).getByRole('radio', { name: '공가' }))
        await user.click(within(dialog).getByRole('button', { name: '등록' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        const cell = screen
          .getByRole('button', { name: '8월 26일 수요일 휴가 1명' })
          .closest('td') as HTMLElement
        expect(within(cell).getByText('김성호')).toBeInTheDocument()
      })

      it('반차가 아니면 종료일 칸이 있다', async () => {
        const { user } = setup({ userName: '김성호' })
        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByLabelText('종료일')).toBeInTheDocument()

        await user.click(within(dialog).getByRole('radio', { name: '오전반차' }))
        expect(within(dialog).queryByLabelText('종료일')).not.toBeInTheDocument()

        await user.click(within(dialog).getByRole('radio', { name: '공가' }))
        expect(within(dialog).getByLabelText('종료일')).toBeInTheDocument()
      })

      it('공가를 며칠에 걸쳐 낼 수 있다', async () => {
        const { user } = setup({ userName: '김성호' })
        const dialog = await open(user, EMPTY_DAY)

        await user.click(within(dialog).getByRole('radio', { name: '공가' }))
        await user.clear(within(dialog).getByLabelText('종료일'))
        await user.type(within(dialog).getByLabelText('종료일'), '2026-08-28')
        await user.click(within(dialog).getByRole('button', { name: '등록' }))

        const lastDay = screen
          .getByRole('button', { name: '8월 28일 금요일 휴가 1명' })
          .closest('td') as HTMLElement
        expect(within(lastDay).getByText('김성호')).toBeInTheDocument()
      })

      it('같은 사람이 같은 날 두 번 내면 막는다', async () => {
        const { user } = setup({ userName: '김성호' })
        const dialog = await open(user, SHARED_DAY)

        await user.click(within(dialog).getByRole('radio', { name: '오전반차' }))
        await user.click(within(dialog).getByRole('button', { name: '등록' }))

        expect(within(dialog).getByRole('alert')).toHaveTextContent(
          '8월 13일부터 연차가 이미 있습니다.',
        )
      })

      it('me 를 모르면 등록하지 못한다', async () => {
        const { user } = setup()
        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByRole('button', { name: '등록' })).toBeDisabled()
      })
    })

    describe('공휴일 지정', () => {
      it('관리자가 아니면 공휴일 칸이 없다', async () => {
        const { user } = setup({ userName: '김성호' })

        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).queryByLabelText('공휴일 이름')).not.toBeInTheDocument()
      })

      it('관리자가 지정하면 격자에 뜬다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)

        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        expect(within(screen.getByRole('table')).getByText('창립기념일')).toBeInTheDocument()
      })

      it('연휴는 마지막 날까지 이어진다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)

        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.clear(within(dialog).getByLabelText('공휴일 종료일'))
        await user.type(within(dialog).getByLabelText('공휴일 종료일'), '2026-08-28')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        expect(within(screen.getByRole('table')).getAllByText('창립기념일')).toHaveLength(3)
        expect(within(dialog).getByText('연휴')).toBeInTheDocument()
      })

      it('연휴를 해제하면 사흘이 한 번에 사라진다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)
        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.clear(within(dialog).getByLabelText('공휴일 종료일'))
        await user.type(within(dialog).getByLabelText('공휴일 종료일'), '2026-08-28')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        await user.click(within(dialog).getByRole('button', { name: '해제' }))

        expect(within(screen.getByRole('table')).queryByText('창립기념일')).not.toBeInTheDocument()
      })

      it('해제하면 사라진다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })
        const dialog = await open(user, EMPTY_DAY)
        await user.type(within(dialog).getByLabelText('공휴일 이름'), '창립기념일')
        await user.click(within(dialog).getByRole('button', { name: '지정' }))

        await user.click(within(dialog).getByRole('button', { name: '해제' }))

        expect(within(screen.getByRole('table')).queryByText('창립기념일')).not.toBeInTheDocument()
      })

      it('법정공휴일은 고칠 수 없다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })

        const dialog = await open(user, '8월 15일 토요일 휴가 0명')

        expect(within(dialog).getByText('법정공휴일')).toBeInTheDocument()
        expect(within(dialog).queryByLabelText('공휴일 이름')).not.toBeInTheDocument()
      })

      it('이름이 비면 지정할 수 없다', async () => {
        const { user } = setup({ userName: '김성호', isAdmin: true })

        const dialog = await open(user, EMPTY_DAY)

        expect(within(dialog).getByRole('button', { name: '지정' })).toBeDisabled()
      })
    })

    describe('삭제', () => {
      it('본인 휴가에만 삭제 버튼이 있다', async () => {
        const { user } = setup({ userName: '김성호' })

        const list = within(await open(user, SHARED_DAY)).getByRole('list')

        expect(within(list).getByRole('button', { name: '김성호 연차 삭제' })).toBeInTheDocument()
        expect(within(list).queryByRole('button', { name: /이영희/ })).not.toBeInTheDocument()
      })

      it('확인창에서 삭제하면 팝업이 닫히고 격자에서 사라진다', async () => {
        const { user } = setup({ userName: '김성호' })
        const dialog = await open(user, SHARED_DAY)
        await user.click(within(dialog).getByRole('button', { name: '김성호 연차 삭제' }))

        await user.click(screen.getByRole('button', { name: '삭제' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(within(screen.getByRole('table')).queryByText('김성호')).not.toBeInTheDocument()
      })
    })
  })
})
