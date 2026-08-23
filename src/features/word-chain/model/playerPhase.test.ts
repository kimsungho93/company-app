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
  loserId: null,
  ...over,
})

describe('playerPhase', () => {
  it('차례인 사람은 TURN 이다', () => {
    expect(playerPhase(game(), 1)).toBe('TURN')
  })

  it('살아있지만 남의 차례면 ALIVE 다', () => {
    expect(playerPhase(game(), 2)).toBe('ALIVE')
  })

  it('turnOrder 에 없으면 SPECTATOR 다', () => {
    expect(playerPhase(game(), 9)).toBe('SPECTATOR')
  })
})
