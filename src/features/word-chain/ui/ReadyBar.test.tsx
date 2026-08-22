import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReadyBar } from './ReadyBar'

const setup = (over: Partial<Parameters<typeof ReadyBar>[0]> = {}) => {
  const props = {
    avatar: null,
    onAvatarChange: vi.fn(),
    isHost: false,
    ready: false,
    allReady: false,
    onReadyChange: vi.fn(),
    onStart: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<ReadyBar {...props} />) }
}

describe('ReadyBar', () => {
  it('아바타를 고르면 알린다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('radio', { name: '여자 아바타' }))

    expect(props.onAvatarChange).toHaveBeenCalledWith('FEMALE')
  })

  it('고른 아바타가 눌린 상태다', () => {
    setup({ avatar: 'MALE' })

    expect(screen.getByRole('radio', { name: '남자 아바타' })).toBeChecked()
  })

  it('참가자에게는 준비 버튼이 있다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: '준비' }))

    expect(props.onReadyChange).toHaveBeenCalledWith(true)
  })

  it('준비를 취소하면 false 를 보낸다', async () => {
    const { user, props } = setup({ ready: true })

    await user.click(screen.getByRole('button', { name: '준비 취소' }))

    expect(props.onReadyChange).toHaveBeenCalledWith(false)
  })

  it('방장에게는 준비 버튼이 없고 시작 버튼이 있다', () => {
    setup({ isHost: true, allReady: true })

    expect(screen.queryByRole('button', { name: /준비/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '시작' })).toBeEnabled()
  })

  it('전원 준비 전에는 시작이 막힌다', () => {
    setup({ isHost: true, allReady: false })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('시작을 누르면 알린다', async () => {
    const { user, props } = setup({ isHost: true, allReady: true })

    await user.click(screen.getByRole('button', { name: '시작' }))

    expect(props.onStart).toHaveBeenCalled()
  })
})
