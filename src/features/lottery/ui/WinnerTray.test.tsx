import { act, render, renderHook, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LotteryWinner } from '../api/types'
import { usePresentedWinners, WINNER_EXIT_MS } from '../model/usePresentedWinners'
import { WinnerTray } from './WinnerTray'

const start = Date.parse('2026-09-14T00:00:00Z')
const winner = (name: string, delay = 0): LotteryWinner => ({ name, drawnAt: new Date(start + delay).toISOString() })

describe('winner presentation', () => {
  afterEach(() => vi.useRealTimers())

  it('holds the winner until the ball exit animation completes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(start)
    const winners = [winner('선도우')]
    const { result } = renderHook(() => usePresentedWinners(winners, 0))
    expect(result.current).toEqual([])
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS - 1))
    expect(result.current).toEqual([])
    await act(async () => vi.advanceTimersByTimeAsync(21))
    expect(result.current).toEqual(winners)
  })

  it('shows already announced results immediately to someone joining late', () => {
    vi.useFakeTimers()
    vi.setSystemTime(start + 20_000)
    const winners = [winner('선도우'), winner('육이슬', 4000)]
    const { result } = renderHook(() => usePresentedWinners(winners, 0))
    expect(result.current).toEqual(winners)
  })

  it('still schedules the last winner when the reveal boundary passes between render and effect', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(start + WINNER_EXIT_MS + 1)
    const clock = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(start + WINNER_EXIT_MS - 1)
      .mockReturnValueOnce(start + WINNER_EXIT_MS - 1)
      .mockReturnValue(start + WINNER_EXIT_MS + 1)
    try {
      const winners = [winner('선도우')]
      const { result } = renderHook(() => usePresentedWinners(winners, 0))
      expect(result.current).toEqual([])
      await act(async () => vi.advanceTimersByTimeAsync(20))
      expect(result.current).toEqual(winners)
    } finally {
      clock.mockRestore()
    }
  })

  it('uses server offset instead of a skewed local clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(start - 30_000)
    const winners = [winner('선도우')]
    const { result } = renderHook(() => usePresentedWinners(winners, 30_000))
    expect(result.current).toEqual([])
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS + 20))
    expect(result.current).toEqual(winners)
  })

  it('presents consecutive arrivals separately and clears results on restart', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(start)
    const winners = [winner('선도우'), winner('육이슬', 4000)]
    const { result, rerender } = renderHook(({ list }) => usePresentedWinners(list, 0), { initialProps: { list: winners } })
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS + 20))
    expect(result.current.map((item) => item.name)).toEqual(['선도우'])
    await act(async () => vi.advanceTimersByTimeAsync(4000))
    expect(result.current.map((item) => item.name)).toEqual(['선도우', '육이슬'])
    rerender({ list: [] })
    expect(result.current).toEqual([])
  })

  it('announces the newest winner, completion and restart without retaining old results', () => {
    const first = winner('선도우')
    const second = winner('육이슬', 4000)
    const { rerender } = render(<WinnerTray winners={[]} count={2} finished={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('추첨을 기다리고 있습니다.')
    rerender(<WinnerTray winners={[first]} count={2} finished={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('1번째 당첨자 선도우')
    rerender(<WinnerTray winners={[first, second]} count={2} finished />)
    expect(screen.getByRole('status')).toHaveTextContent('2번째 당첨자 육이슬. 추첨이 완료되었습니다.')
    expect(within(screen.getByRole('list', { name: '발표 순서대로 당첨자' })).getAllByRole('listitem')).toHaveLength(2)
    rerender(<WinnerTray winners={[]} count={2} finished={false} />)
    expect(screen.getByRole('status')).toHaveTextContent('추첨을 기다리고 있습니다.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
