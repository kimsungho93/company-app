import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createTestWrapper } from '@/test/storeWrapper'
import { MainNav } from './MainNav'

const setup = () => {
  const { wrapper } = createTestWrapper({ withRouter: true })
  return { user: userEvent.setup(), ...render(<MainNav />, { wrapper }) }
}

const trigger = () => screen.getByRole('button', { name: '업무' })

describe('MainNav', () => {
  it('처음에는 닫혀 있다', () => {
    setup()

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: '휴가' })).not.toBeInTheDocument()
  })

  it('누르면 열리고 하위 항목이 보인다', async () => {
    const { user } = setup()

    await user.click(trigger())

    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: '휴가' })).toHaveAttribute('href', '/leave')
  })

  // 닫기만 하고 포커스를 두면 키보드 사용자가 어디 있는지 잃는다
  it('Escape 로 닫히고 포커스가 버튼으로 돌아온다', async () => {
    const { user } = setup()
    await user.click(trigger())

    await user.keyboard('{Escape}')

    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveFocus()
  })

  it('바깥을 누르면 닫힌다', async () => {
    const { user } = setup()
    await user.click(trigger())

    await user.click(document.body)

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })

  // 열린 채로 남으면 이동한 화면을 메뉴가 가린다
  it('항목을 고르면 닫힌다', async () => {
    const { user } = setup()
    await user.click(trigger())

    await user.click(screen.getByRole('link', { name: '휴가' }))

    await waitFor(() => expect(trigger()).toHaveAttribute('aria-expanded', 'false'))
  })
})
