import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTLE_DURATION_MS, WINNER_EXIT_MS } from '../model/drawTiming'
import { LotteryMachine } from './LotteryMachine'
import type { LotteryMachineProps } from './LotteryMachine'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, frameloop }: { children: ReactNode; frameloop: string }) => <div data-testid="canvas" data-frameloop={frameloop}>{children}</div>,
}))
vi.mock('./machine/MachineScene', () => ({
  MachineScene: ({ mixing, status }: { mixing?: boolean; status: string }) => <div data-testid="scene" data-mixing={mixing ?? status === 'DRAWING'} />,
}))

const startedAt = Date.parse('2026-09-14T00:00:00Z')
const props: LotteryMachineProps = {
  participants: ['선도우', '육이슬'], winners: [], status: 'DRAWING', drawId: 1, nextDrawAt: null, serverOffsetMs: 0,
}
const finalWinner = { name: '선도우', drawnAt: new Date(startedAt).toISOString() }

describe('LotteryMachine presentation lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(startedAt)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the final draw mixing until its ball is presented, then renders the full settling motion', async () => {
    const { rerender } = render(<LotteryMachine {...props} />)
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'true')
    rerender(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} />)
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'true')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'always')
    expect(screen.getByRole('img')).toHaveAccessibleName(/추첨 중입니다/)

    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS - 1))
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'true')
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'false')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'always')
    expect(screen.getByRole('img')).toHaveAccessibleName(/추첨이 완료되었습니다/)

    await act(async () => vi.advanceTimersByTimeAsync(SETTLE_DURATION_MS - 1))
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'always')
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand')
  })

  it.each([
    { deadline: WINNER_EXIT_MS, frameloop: 'always' },
    { deadline: WINNER_EXIT_MS + SETTLE_DURATION_MS, frameloop: 'demand' },
  ])('finishes the phase when deadline $deadline passes between render and effect', async ({ deadline, frameloop }) => {
    vi.setSystemTime(startedAt + deadline + 1)
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(startedAt + deadline - 1)
      .mockReturnValueOnce(startedAt + deadline - 1)
      .mockReturnValue(startedAt + deadline + 1)
    render(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} />)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'false')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', frameloop)
  })

  it('uses server time to resume an in-flight final ball after joining', async () => {
    render(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} serverOffsetMs={WINNER_EXIT_MS - 200} />)
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'true')
    await act(async () => vi.advanceTimersByTimeAsync(200))
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'false')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'always')
  })

  it('does not restart animation when joining an already completed draw', () => {
    vi.setSystemTime(startedAt + WINNER_EXIT_MS + 1000)
    render(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} />)
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'false')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand')
  })

  it('cancels the finishing motion immediately when a new draw is prepared', async () => {
    const { rerender } = render(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} />)
    rerender(<LotteryMachine {...props} status="READY" drawId={2} />)
    expect(screen.getByTestId('scene')).toHaveAttribute('data-mixing', 'false')
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand')
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS + 1000))
    expect(screen.getByRole('img')).toHaveAccessibleName(/추첨을 기다리고 있습니다/)
  })

  it('keeps reduced-motion rendering idle while retaining the shared presentation deadline', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    render(<LotteryMachine {...props} status="FINISHED" winners={[finalWinner]} />)
    expect(screen.getByTestId('canvas')).toHaveAttribute('data-frameloop', 'demand')
    expect(screen.getByRole('img')).toHaveAccessibleName(/추첨 중입니다/)
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS))
    expect(screen.getByRole('img')).toHaveAccessibleName(/추첨이 완료되었습니다/)
  })
})
