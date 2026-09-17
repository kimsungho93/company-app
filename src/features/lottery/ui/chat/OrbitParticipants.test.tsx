import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrbitParticipants } from './OrbitParticipants'

const state = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('./orbitScene', () => ({
  createLotteryOrbitScene: (...args: unknown[]) => state.create(...args),
}))
vi.mock('@/shared/theme', () => ({ useTheme: () => ({ resolved: 'light' }) }))
const instance = {
  select: vi.fn(),
  setTyping: vi.fn(),
  pulse: vi.fn(),
  rotateBy: vi.fn(),
  updateColors: vi.fn(),
  dispose: vi.fn(),
}
const members = Array.from({ length: 9 }, (_, index) => ({
  userId: index + 1,
  name: `참여자 ${index + 1}`,
}))

describe('OrbitParticipants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.create.mockReturnValue(instance)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('limits the orbit to six real members including the current user and keeps the rest accessible', async () => {
    const onSelect = vi.fn(),
      user = userEvent.setup()
    const { container, unmount } = render(
      <OrbitParticipants
        members={members}
        currentUserId={9}
        selectedId={null}
        typing={[]}
        onSelect={onSelect}
      />,
    )
    await waitFor(() => expect(state.create).toHaveBeenCalledOnce())
    expect(container.querySelectorAll('[data-orbit-person]')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '참여자 9, 나 대화 보기' })).toBeInTheDocument()
    await user.click(screen.getByText('+3명'))
    await user.click(screen.getByRole('button', { name: '참여자 8 대화 보기' }))
    expect(onSelect).toHaveBeenCalledWith(8)
    await user.click(screen.getByRole('button', { name: '궤도를 오른쪽으로 회전' }))
    expect(instance.rotateBy).toHaveBeenCalledWith(0.55)
    unmount()
    expect(instance.dispose).toHaveBeenCalledOnce()
  })

  it('updates selection and typing without creating a continuously running new scene', async () => {
    const props = { members: members.slice(0, 4), currentUserId: 1, onSelect: vi.fn() }
    const { rerender } = render(<OrbitParticipants {...props} selectedId={null} typing={[]} />)
    await waitFor(() => expect(state.create).toHaveBeenCalledOnce())
    rerender(<OrbitParticipants {...props} selectedId={2} typing={[members[1]]} />)
    expect(instance.select).toHaveBeenLastCalledWith(2)
    expect(instance.setTyping).toHaveBeenLastCalledWith(2)
    expect(state.create).toHaveBeenCalledOnce()
  })

  it('keeps person selection and rotation usable when WebGL initialization fails', async () => {
    state.create.mockImplementation(() => {
      throw new Error('WebGL unavailable')
    })
    const onSelect = vi.fn(),
      user = userEvent.setup()
    render(
      <OrbitParticipants
        members={members.slice(0, 3)}
        currentUserId={1}
        selectedId={null}
        typing={[]}
        onSelect={onSelect}
      />,
    )
    await waitFor(() => expect(state.create).toHaveBeenCalledOnce())
    expect(screen.getByTestId('chat-orbit')).toHaveAttribute('data-ready', 'false')
    await user.click(screen.getByRole('button', { name: '참여자 2 대화 보기' }))
    expect(onSelect).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: '궤도를 왼쪽으로 회전' }))
    expect(instance.rotateBy).not.toHaveBeenCalled()
  })
})
