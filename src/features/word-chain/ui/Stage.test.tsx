import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GameState, Player } from '../api/types'
import { Stage } from './Stage'

const player = (userId: number, over: Partial<Player> = {}): Player => ({
  userId,
  name: `사람${userId}`,
  avatar: null,
  ready: false,
  ...over,
})

describe('Stage', () => {
  it('참가자 이름을 연단에 적는다', () => {
    render(<Stage players={[player(1, { name: '김성호' })]} hostId={1} />)

    expect(screen.getByText('김성호')).toBeInTheDocument()
  })

  it('방장을 표시한다', () => {
    render(<Stage players={[player(1), player(2)]} hostId={2} />)

    const host = screen.getByRole('listitem', { name: '사람2' })
    expect(within(host).getByText('방장')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('방장')).toBeNull()
  })

  it('준비한 사람을 표시한다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).getByText('준비')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람2' })).queryByText('준비')).toBeNull()
  })

  it('방장이 준비여도 방장 표시만 붙는다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={1} />)

    const host = screen.getByRole('listitem', { name: '사람1' })

    expect(within(host).getByText('방장')).toBeInTheDocument()
    expect(within(host).queryByText('준비')).toBeNull()
  })

  it('아바타를 안 고른 사람은 남자로 그린다', () => {
    render(<Stage players={[player(1), player(2, { avatar: 'FEMALE' })]} hostId={9} />)

    const first = within(screen.getByRole('listitem', { name: '사람1' })).getByRole('img')
    const second = within(screen.getByRole('listitem', { name: '사람2' })).getByRole('img')

    expect(first).toHaveAttribute('src', '/avatars/male.png')
    expect(second).toHaveAttribute('src', '/avatars/female.png')
  })

  it('5명이면 한 줄이다', () => {
    render(<Stage players={[1, 2, 3, 4, 5].map((n) => player(n))} hostId={9} />)

    expect(screen.getAllByRole('list')).toHaveLength(1)
  })

  it('6명부터 두 줄이 된다', () => {
    render(<Stage players={[1, 2, 3, 4, 5, 6].map((n) => player(n))} hostId={9} />)

    const [back, front] = screen.getAllByRole('list')

    expect(within(back).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(
      ['사람1', '사람2', '사람3'],
    )
    expect(
      within(front).getAllByRole('listitem').map((li) => li.getAttribute('aria-label')),
    ).toEqual(['사람4', '사람5', '사람6'])
  })

  it('onSelectPlayer 가 없으면 연단이 버튼이 아니다', () => {
    render(<Stage players={[player(1)]} hostId={9} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('연단을 누르면 그 사람의 userId 를 넘긴다', async () => {
    const user = userEvent.setup()
    const onSelectPlayer = vi.fn()
    render(<Stage players={[player(1), player(7)]} hostId={1} onSelectPlayer={onSelectPlayer} />)

    await user.click(screen.getByRole('button', { name: /사람7/ }))

    expect(onSelectPlayer).toHaveBeenCalledWith(7)
  })

  it('방장 자신의 연단은 누를 수 없다', () => {
    render(<Stage players={[player(1), player(7)]} hostId={1} onSelectPlayer={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /사람1/ })).not.toBeInTheDocument()
  })

  const game = (over: Partial<GameState> = {}): GameState => ({
    currentWord: '사과',
    turnUserId: 1,
    turnEndsAt: 1000,
    triesLeft: 3,
    usedWords: ['사과'],
    turnOrder: [1, 2],
    eliminated: [],
    bubbles: [],
    loserId: null,
    ...over,
  })

  it('게임이 없으면 준비 표시를 그대로 그린다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).getByText('준비')).toBeInTheDocument()
  })

  it('게임 중에는 준비 표시를 그리지 않는다', () => {
    render(<Stage players={[player(1, { ready: true }), player(2)]} hostId={9} game={game()} />)

    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('준비')).toBeNull()
  })

  it('turnOrder 에 없는 사람에게 관전 표시가 붙는다', () => {
    render(
      <Stage players={[player(1), player(9)]} hostId={1} game={game()} />,
    )

    expect(within(screen.getByRole('listitem', { name: '사람9' })).getByText('관전')).toBeInTheDocument()
  })


  it('말풍선은 낸 사람 자리에만 뜬다', () => {
    render(
      <Stage
        players={[player(1), player(2)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 2, word: '과일', state: 'PASS' }] })}
      />,
    )

    expect(within(screen.getByRole('listitem', { name: '사람2' })).getByText('과일')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: '사람1' })).queryByText('과일')).toBeNull()
  })

  it('사전을 못 쓴 통과에는 미확인 표시가 붙는다', () => {
    render(
      <Stage
        players={[player(1)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 1, word: '과일', state: 'PASS', verified: false }] })}
      />,
    )

    expect(screen.getByText('사전 확인 못 함')).toBeInTheDocument()
  })

  it('오답에는 틀린 이유가 붙는다', () => {
    render(
      <Stage
        players={[player(1)]}
        hostId={9}
        game={game({ bubbles: [{ userId: 1, word: '바나나', state: 'FAIL', reason: 'NOT_CHAINED' }] })}
      />,
    )

    expect(screen.getByText('앞 단어와 안 이어집니다')).toBeInTheDocument()
  })
})
