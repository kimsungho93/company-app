import type { GameState } from '../api/types'

export type PlayerPhase = 'TURN' | 'ALIVE' | 'ELIMINATED' | 'SPECTATOR' | 'WINNER'

export const playerPhase = (game: GameState, userId: number): PlayerPhase => {
  if (!game.turnOrder.includes(userId)) return 'SPECTATOR'
  if (game.winnerId !== null) return game.winnerId === userId ? 'WINNER' : 'ELIMINATED'
  if (game.eliminated.includes(userId)) return 'ELIMINATED'
  return game.turnUserId === userId ? 'TURN' : 'ALIVE'
}
