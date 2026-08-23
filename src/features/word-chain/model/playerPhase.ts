import type { GameState } from '../api/types'

export type PlayerPhase = 'TURN' | 'ALIVE' | 'SPECTATOR'

export const playerPhase = (game: GameState, userId: number): PlayerPhase => {
  if (!game.turnOrder.includes(userId)) return 'SPECTATOR'
  return game.turnUserId === userId ? 'TURN' : 'ALIVE'
}
