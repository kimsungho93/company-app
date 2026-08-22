import type { Player } from '../api/types'

const FRONT_ONLY = 5

export interface Seats {
  back: Player[]
  front: Player[]
}

export const splitSeats = (players: Player[]): Seats => {
  if (players.length <= FRONT_ONLY) return { back: [], front: players.slice() }

  const backCount = Math.floor(players.length / 2)
  return { back: players.slice(0, backCount), front: players.slice(backCount) }
}
