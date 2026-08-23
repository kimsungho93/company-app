import { describe, expect, it } from 'vitest'
import type { GameState } from '../api/types'
import { playerPhase } from './playerPhase'

const game = (over: Partial<GameState> = {}): GameState => ({
  currentWord: '사과',
  turnUserId: 1,
  turnEndsAt: 1000,
  triesLeft: 3,
  usedWords: ['사과'],
  turnOrder: [1, 2, 3],
  eliminated: [],
  bubbles: [],
  winnerId: null,
  ...over,
})

describe('playerPhase', () => {
  it('차례인 사람은 TURN 이다', () => {
    expect(playerPhase(game(), 1)).toBe('TURN')
  })

  it('살아있지만 남의 차례면 ALIVE 다', () => {
    expect(playerPhase(game(), 2)).toBe('ALIVE')
  })

  it('탈락한 사람은 ELIMINATED 다', () => {
    expect(playerPhase(game({ eliminated: [2] }), 2)).toBe('ELIMINATED')
  })

  it('turnOrder 에 없으면 SPECTATOR 다', () => {
    expect(playerPhase(game(), 9)).toBe('SPECTATOR')
  })

  it('판이 끝나면 승자는 WINNER 다', () => {
    expect(playerPhase(game({ winnerId: 1, turnUserId: null }), 1)).toBe('WINNER')
  })

  it('판이 끝나면 승자가 아닌 참가자는 ELIMINATED 다', () => {
    expect(playerPhase(game({ winnerId: 1 }), 2)).toBe('ELIMINATED')
  })

  it('판이 끝나도 관전자는 SPECTATOR 로 남는다', () => {
    expect(playerPhase(game({ winnerId: 1 }), 9)).toBe('SPECTATOR')
  })

  it('탈락자가 차례로 잡히지 않는다', () => {
    expect(playerPhase(game({ turnUserId: 2, eliminated: [2] }), 2)).toBe('ELIMINATED')
  })
})
