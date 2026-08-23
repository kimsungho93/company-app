import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerBar } from './AnswerBar'

const setup = (over: Partial<Parameters<typeof AnswerBar>[0]> = {}) => {
  const props = {
    phase: 'TURN' as const,
    currentWord: '사과',
    turnPlayerName: '김성호',
    triesLeft: 3,
    awaitingJudgement: false,
    turnEndsAt: 4000,
    serverNow: 1000,
    onSubmit: vi.fn(),
    ...over,
  }
  return { user: userEvent.setup(), props, ...render(<AnswerBar {...props} />) }
}

describe('AnswerBar', () => {
  it('내 차례면 입력할 수 있다', () => {
    setup()

    expect(screen.getByRole('textbox')).toBeEnabled()
  })

  it('남의 차례면 누구 차례인지 알리고 입력을 막는다', () => {
    setup({ phase: 'ALIVE', turnPlayerName: '이영희' })

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByText('이영희 님 차례')).toBeInTheDocument()
  })

  it('관전이면 알린다', () => {
    setup({ phase: 'SPECTATOR' })

    expect(screen.getByText('다음 판부터 참가합니다')).toBeInTheDocument()
  })

  it('남은 기회를 보여준다', () => {
    setup({ triesLeft: 2 })

    expect(screen.getByText('2번 남음')).toBeInTheDocument()
  })

  it('이어갈 글자를 안내 문구로 보여준다', () => {
    setup({ currentWord: '사과' })

    expect(screen.getByPlaceholderText('과로 시작하는 세 글자')).toBeInTheDocument()
  })

  it('받침이 있으면 조사가 으로가 된다', () => {
    setup({ currentWord: '미역국' })

    expect(screen.getByPlaceholderText('국으로 시작하는 세 글자')).toBeInTheDocument()
  })

  it('받침이 ㄹ 이면 조사가 로다', () => {
    setup({ currentWord: '개나리풀' })

    expect(screen.getByPlaceholderText('풀로 시작하는 세 글자')).toBeInTheDocument()
  })

  it('버튼을 누르면 제출하고 칸을 비운다', async () => {
    const { user, props } = setup()
    const input = screen.getByRole('textbox')

    await user.type(input, '과일')
    await user.click(screen.getByRole('button', { name: '내기' }))

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
    expect(input).toHaveValue('')
  })

  it('조합 중이 아니면 Enter 한 번에 제출된다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
  })

  it('조합 중 Enter 는 조합이 끝난 뒤 제출된다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(props.onSubmit).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).toHaveBeenCalledWith('과일')
  })

  it('조합이 끝나도 Enter 를 안 눌렀으면 제출하지 않는다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('제출을 못 한 채 차례가 넘어가면 다음 조합에서 새어 나가지 않는다', () => {
    const { props, rerender } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    rerender(<AnswerBar {...props} phase="ALIVE" />)
    rerender(<AnswerBar {...props} phase="TURN" />)

    fireEvent.change(input, { target: { value: '기차' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('새 조합이 시작되면 이전에 눌린 Enter 가 새어 나가지 않는다', () => {
    const { props } = setup()
    const input = screen.getByRole('textbox')

    fireEvent.change(input, { target: { value: '과이' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '과일' } })
    fireEvent.compositionEnd(input)

    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('판정을 기다리는 동안은 못 낸다', () => {
    setup({ awaitingJudgement: true })

    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: '내기' })).toBeDisabled()
    expect(screen.getByText('확인 중…')).toBeInTheDocument()
  })

  it('빈 칸은 제출하지 않는다', () => {
    const { props } = setup()

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })

    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
