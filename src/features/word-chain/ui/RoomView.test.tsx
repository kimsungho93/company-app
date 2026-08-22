import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Player, RoomState } from '../api/types'
import { RoomView } from './RoomView'

const player = (userId: number, over: Partial<Player> = {}): Player => ({
  userId,
  name: `사람${userId}`,
  avatar: null,
  ready: false,
  ...over,
})

const room = (over: Partial<RoomState> = {}): RoomState => ({
  id: 7,
  name: '점심내기 한판',
  status: 'WAITING',
  hostId: 1,
  capacity: 10,
  players: [player(1), player(2)],
  ...over,
})

const setup = (over: Partial<Parameters<typeof RoomView>[0]> = {}) => {
  const props = {
    room: room(),
    myUserId: 2,
    onAvatarChange: vi.fn(),
    onReadyChange: vi.fn(),
    onTransfer: vi.fn(),
    onStart: vi.fn(),
    onLeave: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<RoomView {...props} />) }
}

describe('RoomView', () => {
  it('방 이름과 인원을 보여준다', () => {
    setup()

    expect(screen.getByRole('heading', { name: '점심내기 한판' })).toBeInTheDocument()
    expect(screen.getByText('2/10')).toBeInTheDocument()
  })

  it('나가기를 누르면 알린다', async () => {
    const { user, props } = setup()

    await user.click(screen.getByRole('button', { name: '나가기' }))

    expect(props.onLeave).toHaveBeenCalled()
  })

  it('내가 방장이 아니면 준비 버튼이 있다', () => {
    setup({ myUserId: 2 })

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
  })

  it('내가 방장이면 시작 버튼이 있다', () => {
    setup({ myUserId: 1 })

    expect(screen.getByRole('button', { name: '시작' })).toBeInTheDocument()
  })

  it('방장 말고 안 준비한 사람이 있으면 시작이 막힌다', () => {
    setup({ myUserId: 1, room: room({ players: [player(1), player(2)] }) })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방장이 준비 아님이어도 나머지가 준비면 시작이 열린다', () => {
    setup({
      myUserId: 1,
      room: room({ players: [player(1, { ready: false }), player(2, { ready: true })] }),
    })

    expect(screen.getByRole('button', { name: '시작' })).toBeEnabled()
  })

  it('방장 혼자면 시작이 막힌다', () => {
    setup({ myUserId: 1, room: room({ players: [player(1)] }) })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방장이 아니면 남의 연단을 누를 수 없다', () => {
    setup({ myUserId: 2 })

    expect(screen.queryByRole('button', { name: /사람1/ })).not.toBeInTheDocument()
  })

  it('방장이 남의 연단을 누르면 확인창이 뜨고, 확인하면 알린다', async () => {
    const { user, props } = setup({ myUserId: 1 })

    await user.click(screen.getByRole('button', { name: /사람2/ }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('사람2 님에게 방장을 넘기시겠습니까?')

    await user.click(screen.getByRole('button', { name: '넘기기' }))

    expect(props.onTransfer).toHaveBeenCalledWith(2)
  })

  it('양도를 취소하면 알리지 않는다', async () => {
    const { user, props } = setup({ myUserId: 1 })
    await user.click(screen.getByRole('button', { name: /사람2/ }))

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(props.onTransfer).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
