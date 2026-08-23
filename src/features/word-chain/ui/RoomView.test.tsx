import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GameState, Player, RoomState } from '../api/types'
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
  serverNow: 0,
  turnSeconds: 5,
  noReuse: false,
  game: null,
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
    onAnswer: vi.fn(),
    onOptionsChange: vi.fn(),
    onReorder: vi.fn(),
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

    await user.click(screen.getByRole('button', { name: '사람2 님에게 방장 넘기기' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('사람2 님에게 방장을 넘기시겠습니까?')

    await user.click(screen.getByRole('button', { name: '넘기기' }))

    expect(props.onTransfer).toHaveBeenCalledWith(2)
  })

  it('양도를 취소하면 알리지 않는다', async () => {
    const { user, props } = setup({ myUserId: 1 })
    await user.click(screen.getByRole('button', { name: '사람2 님에게 방장 넘기기' }))

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(props.onTransfer).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  const playing = (over: Partial<GameState> = {}): RoomState =>
    room({
      status: 'PLAYING',
      game: {
        currentWord: '사과',
        turnUserId: 1,
        turnEndsAt: 4000,
        triesLeft: 3,
        usedWords: ['사과'],
        turnOrder: [1, 2],
        eliminated: [],
        bubbles: [],
        winnerId: null,
        ...over,
      },
    })

  it('대기 중이면 준비 바를 그린다', () => {
    setup()

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '답' })).not.toBeInTheDocument()
  })

  it('게임 중이면 답 입력칸을 그린다', () => {
    setup({ myUserId: 1, room: playing() })

    expect(screen.getByRole('textbox', { name: '답' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '준비' })).not.toBeInTheDocument()
  })

  it('이어갈 단어를 보여준다', () => {
    setup({ myUserId: 1, room: playing({ currentWord: '기차' }) })

    expect(screen.getByTestId('current-word')).toHaveTextContent('기차')
  })

  it('답을 내면 알린다', async () => {
    const { user, props } = setup({ myUserId: 1, room: playing() })

    await user.type(screen.getByRole('textbox', { name: '답' }), '과일')
    await user.click(screen.getByRole('button', { name: '내기' }))

    expect(props.onAnswer).toHaveBeenCalledWith('과일')
  })

  it('내 답을 판정하는 동안 입력칸이 잠긴다', () => {
    setup({
      myUserId: 1,
      room: playing({ bubbles: [{ userId: 1, word: '과일', state: 'PENDING' }] }),
    })

    expect(screen.getByRole('textbox', { name: '답' })).toBeDisabled()
  })

  it('남의 답을 판정하는 동안에는 내 입력칸이 안 잠긴다', () => {
    setup({
      myUserId: 1,
      room: playing({ bubbles: [{ userId: 2, word: '과일', state: 'PENDING' }] }),
    })

    expect(screen.getByRole('textbox', { name: '답' })).toBeEnabled()
  })

  it('재사용 금지가 켜졌으면 나온 단어를 보여준다', () => {
    setup({
      myUserId: 1,
      room: { ...playing({ usedWords: ['사과', '과일'] }), noReuse: true },
    })

    expect(screen.getByTestId('used-words')).toHaveTextContent('과일')
  })

  it('재사용 금지가 꺼졌으면 나온 단어를 보여주지 않는다', () => {
    setup({
      myUserId: 1,
      room: { ...playing({ usedWords: ['사과'] }), noReuse: false },
    })

    expect(screen.queryByTestId('used-words')).not.toBeInTheDocument()
  })

  it('결과 화면에서는 무대가 대기실로 돌아간다', () => {
    setup({
      myUserId: 2,
      room: room({
        status: 'WAITING',
        players: [player(1, { ready: false }), player(2, { ready: true })],
        game: { ...playing().game!, winnerId: 1, turnUserId: null, turnEndsAt: null },
      }),
    })

    const winner = screen.getByRole('listitem', { name: '사람1' })
    const other = screen.getByRole('listitem', { name: '사람2' })

    expect(within(winner).queryByText('탈락')).toBeNull()
    expect(within(other).queryByText('탈락')).toBeNull()
    expect(within(other).getByText('준비')).toBeInTheDocument()
  })

  it('판이 끝나면 승자를 알리고 게임 화면을 걷는다', () => {
    setup({
      myUserId: 2,
      room: room({
        status: 'WAITING',
        game: { ...playing().game!, winnerId: 1, turnUserId: null, turnEndsAt: null },
      }),
    })

    expect(screen.getByText('사람1 님 승리')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '답' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('current-word')).not.toBeInTheDocument()
    expect(screen.queryByTestId('used-words')).not.toBeInTheDocument()
  })

  it('결과 화면에도 준비 바가 그대로 있다', () => {
    setup({
      myUserId: 2,
      room: room({
        status: 'WAITING',
        game: { ...playing().game!, winnerId: 1, turnUserId: null, turnEndsAt: null },
      }),
    })

    expect(screen.getByRole('button', { name: '준비' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '다시 시작' })).not.toBeInTheDocument()
  })

  it('결과 화면에서 준비가 풀려 있으면 시작이 막힌다', () => {
    setup({
      myUserId: 1,
      room: room({
        status: 'WAITING',
        players: [player(1, { ready: false }), player(2, { ready: false })],
        game: { ...playing().game!, winnerId: 1, turnUserId: null, turnEndsAt: null },
      }),
    })

    expect(screen.getByRole('button', { name: '시작' })).toBeDisabled()
  })

  it('방이 들고 있는 턴 시간이 보인다', () => {
    setup({ myUserId: 1 })

    expect(screen.getByRole('radio', { name: '5초' })).toBeChecked()
  })

  it('방장이 턴 시간을 바꾸면 그 값을 알린다', async () => {
    const { user, props } = setup({ myUserId: 1 })

    await user.click(screen.getByRole('radio', { name: '7초' }))

    expect(props.onOptionsChange).toHaveBeenCalledWith({ turnSeconds: 7, noReuse: false })
  })

  it('방장이 아니면 옵션을 못 바꾼다', () => {
    setup({ myUserId: 2 })

    expect(screen.getByRole('radio', { name: '5초' })).toBeDisabled()
  })
})
