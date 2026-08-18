import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { MainNav } from './MainNav'

const meWith = (role: string) => ({
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role,
  status: 'APPROVED',
})

const setup = (role = 'USER') => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(meWith(role))))
  const { wrapper } = createTestWrapper({ withRouter: true })
  return { user: userEvent.setup(), ...render(<MainNav />, { wrapper }) }
}

const trigger = () => screen.getByRole('button', { name: '업무' })
const nav = () => screen.getByRole('navigation', { name: '주 메뉴' })
const gameTrigger = () => screen.getByRole('button', { name: '게임' })

describe('MainNav', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('처음에는 닫혀 있다', () => {
    setup()

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '휴가' })).not.toBeInTheDocument()
  })

  // 토스처럼 누르지 않고 올리기만 해도 열린다
  it('마우스를 올리면 열리고 하위 항목이 보인다', async () => {
    const { user } = setup()

    await user.hover(trigger())

    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '휴가' })).toHaveAttribute('href', '/leave')
    expect(screen.getByText('근무와 휴식을 관리하고')).toBeInTheDocument()
  })

  it('벗어나면 닫힌다', async () => {
    const { user } = setup()
    await user.hover(trigger())

    await user.unhover(nav())

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })

  // 호버가 없는 키보드 사용자도 열 수 있어야 한다
  it('키보드로도 열 수 있다', async () => {
    const { user } = setup()
    trigger().focus()

    await user.keyboard('{Enter}')

    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  })

  // 닫기만 하고 포커스를 두면 키보드 사용자가 어디 있는지 잃는다
  it('Escape 로 닫히고 포커스가 버튼으로 돌아온다', async () => {
    const { user } = setup()
    trigger().focus()
    await user.keyboard('{Enter}')

    await user.keyboard('{Escape}')

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveFocus()
  })

  // 터치에는 호버가 없다. 스치는 것으로 열면 첫 탭이 열기로 먹혀 링크가 한 번에 안 눌린다.
  it('터치로 스치는 것만으로는 열리지 않는다', () => {
    setup()

    fireEvent.pointerEnter(nav(), { pointerType: 'touch' })

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  // 열린 채로 옆 메뉴로 옮기면 패널은 그대로 두고 내용만 바뀌어야 한다
  it('옆 메뉴로 옮기면 그 메뉴 내용으로 바뀐다', async () => {
    const { user } = setup()
    await user.hover(trigger())
    expect(screen.getByRole('link', { name: '휴가' })).toBeInTheDocument()

    await user.hover(gameTrigger())

    expect(gameTrigger()).toHaveAttribute('aria-expanded', 'true')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: '끝말잇기' })).toHaveAttribute(
      'href',
      '/games/word-chain',
    )
    expect(screen.queryByRole('link', { name: '휴가' })).not.toBeInTheDocument()
  })

  // 열린 채로 남으면 이동한 화면을 패널이 가린다
  it('항목을 고르면 닫힌다', async () => {
    const { user } = setup()
    await user.hover(trigger())

    await user.click(screen.getByRole('link', { name: '휴가' }))

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })

  // 헤더 오른쪽에 있던 승인 관리를 주 메뉴 안으로 옮겼다
  describe('관리 메뉴', () => {
    it('관리자에게만 보인다', async () => {
      setup('ADMIN')

      await waitFor(() => expect(screen.getByRole('button', { name: '관리' })).toBeInTheDocument())
    })

    it('일반 사용자에게는 없다', async () => {
      setup('USER')

      await waitFor(() => expect(screen.getByRole('button', { name: '업무' })).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: '관리' })).not.toBeInTheDocument()
    })

    it('게임 오른쪽에 붙는다', async () => {
      setup('ADMIN')
      await waitFor(() => expect(screen.getByRole('button', { name: '관리' })).toBeInTheDocument())

      const labels = screen.getAllByRole('button').map((button) => button.textContent)

      expect(labels).toEqual(['업무', '게임', '관리'])
    })

    it('열면 승인 관리 링크가 나온다', async () => {
      const { user } = setup('ADMIN')
      await waitFor(() => expect(screen.getByRole('button', { name: '관리' })).toBeInTheDocument())

      await user.hover(screen.getByRole('button', { name: '관리' }))

      expect(screen.getByRole('link', { name: '승인 관리' })).toHaveAttribute(
        'href',
        '/admin/users',
      )
    })
  })
})
