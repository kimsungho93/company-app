import { useEffect, useState } from 'react'
import type { LotteryWinner } from '../api/types'
import { WINNER_EXIT_MS } from './drawTiming'

export { WINNER_EXIT_MS } from './drawTiming'

export const usePresentedWinners = (winners: LotteryWinner[], offset: number) => {
  const [now, setNow] = useState(Date.now)
  const current = Math.max(now, Date.now()) + offset
  const visible = winners.filter((winner) => Date.parse(winner.drawnAt) + WINNER_EXIT_MS <= current)
  const next = winners.find((winner) => Date.parse(winner.drawnAt) + WINNER_EXIT_MS > current)

  useEffect(() => {
    if (!next) return
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(next.drawnAt) + WINNER_EXIT_MS - Date.now() - offset) + 20,
    )
    return () => clearTimeout(timer)
  }, [next, offset, now])

  return visible
}
