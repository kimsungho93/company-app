import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameOptions } from './GameOptions'

const setup = (over: Partial<Parameters<typeof GameOptions>[0]> = {}) => {
  const props = {
    turnSeconds: 3,
    noReuse: false,
    disabled: false,
    onChange: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<GameOptions {...props} />) }
}

describe('GameOptions', () => {
  it('3 · 5 · 7초만 고를 수 있다', () => {
    setup()

    expect(screen.getByRole('radio', { name: '3초' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5초' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '7초' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('지금 값이 골라져 있다', () => {
    setup({ turnSeconds: 5 })

    expect(screen.getByRole('radio', { name: '5초' })).toBeChecked()
  })

  it('턴 시간을 바꾸면 재사용 금지를 그대로 실어 알린다', async () => {
    const { user, props } = setup({ noReuse: true })

    await user.click(screen.getByRole('radio', { name: '7초' }))

    expect(props.onChange).toHaveBeenCalledWith({ turnSeconds: 7, noReuse: true })
  })

  it('재사용 금지를 켜면 턴 시간을 그대로 실어 알린다', async () => {
    const { user, props } = setup({ turnSeconds: 5 })

    await user.click(screen.getByRole('checkbox', { name: '한 번 나온 단어 금지' }))

    expect(props.onChange).toHaveBeenCalledWith({ turnSeconds: 5, noReuse: true })
  })

  it('방장이 아니면 못 바꾼다', () => {
    setup({ disabled: true })

    expect(screen.getByRole('radio', { name: '3초' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: '한 번 나온 단어 금지' })).toBeDisabled()
  })
})
