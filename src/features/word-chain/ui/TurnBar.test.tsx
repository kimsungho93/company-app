import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TurnBar } from './TurnBar'

describe('TurnBar', () => {
  it('남은 시간을 애니메이션 길이로 잡는다', () => {
    render(<TurnBar turnEndsAt={5000} serverNow={2000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '3000ms' })
  })

  it('이미 지난 턴은 0 으로 잡는다', () => {
    render(<TurnBar turnEndsAt={1000} serverNow={4000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '0ms' })
  })

  it('턴 중간에 serverNow 만 바뀌어도 길이를 다시 잡지 않는다', () => {
    const { rerender } = render(<TurnBar turnEndsAt={5000} serverNow={2000} />)

    rerender(<TurnBar turnEndsAt={5000} serverNow={4000} />)

    expect(screen.getByTestId('turn-bar')).toHaveStyle({ animationDuration: '3000ms' })
  })
})
