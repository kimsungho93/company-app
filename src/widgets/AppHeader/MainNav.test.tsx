import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createTestWrapper } from '@/test/storeWrapper'
import { MainNav } from './MainNav'

const setup = () => {
  const { wrapper } = createTestWrapper({ withRouter: true })
  return { user: userEvent.setup(), ...render(<MainNav />, { wrapper }) }
}

const trigger = () => screen.getByRole('button', { name: '업무' })
const nav = () => screen.getByRole('navigation', { name: '업무' })

describe('MainNav', () => {
  it('처음에는 닫혀 있다', () => {
    setup()

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '휴가' })).not.toBeInTheDocument()
  })

  // 토스처럼 누르지 않고 올리기만 해도 열린다
  it('마우스를 올리면 열리고 하위 항목이 보인다', async () => {
    const { user } = setup()

    await user.hover(nav())

    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '휴가' })).toHaveAttribute('href', '/leave')
    expect(screen.getByText('근무와 휴식을 관리하고')).toBeInTheDocument()
  })

  it('벗어나면 닫힌다', async () => {
    const { user } = setup()
    await user.hover(nav())

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

  // 열린 채로 남으면 이동한 화면을 패널이 가린다
  it('항목을 고르면 닫힌다', async () => {
    const { user } = setup()
    await user.hover(nav())

    await user.click(screen.getByRole('link', { name: '휴가' }))

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })
})
