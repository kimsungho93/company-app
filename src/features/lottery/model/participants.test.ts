import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARTICIPANTS,
  parseParticipants,
  validateLotterySettings,
  validateLotteryTitle,
} from './participants'

describe('lottery participant validation', () => {
  it('keeps the requested default participant order', () => {
    expect(DEFAULT_PARTICIPANTS).toEqual([
      '선도우',
      '육이슬',
      '유영진',
      '이정규',
      '김성호',
      '허소영',
      '김예린',
      '김현진',
      '이다혜',
      '박찬진',
      '문형석',
      '나예린',
      '김민수',
    ])
  })

  it('trims names without silently merging duplicate people', () => {
    expect(parseParticipants(' 선도우\r\n\n 육이슬 \n선도우')).toEqual([
      '선도우',
      '육이슬',
      '선도우',
    ])
  })

  it('allows a single participant and all participants winning', () => {
    expect(validateLotterySettings({ participants: ['선도우'], winnerCount: 1 })).toBeNull()
    expect(
      validateLotterySettings({ participants: DEFAULT_PARTICIPANTS, winnerCount: 13 }),
    ).toBeNull()
  })

  it.each([
    { participants: [], winnerCount: 1 },
    { participants: ['선도우', ' 선도우 '], winnerCount: 1 },
    { participants: [' '], winnerCount: 1 },
    { participants: ['가'.repeat(31)], winnerCount: 1 },
    { participants: Array.from({ length: 51 }, (_, i) => String(i)), winnerCount: 1 },
    { participants: ['선도우'], winnerCount: 0 },
    { participants: ['선도우'], winnerCount: 2 },
    { participants: ['선도우'], winnerCount: 0.5 },
  ])('rejects invalid settings %j', (settings) => {
    expect(validateLotterySettings(settings)).not.toBeNull()
  })

  it('matches the trimmed title length limits', () => {
    expect(validateLotteryTitle('  ')).not.toBeNull()
    expect(validateLotteryTitle('가'.repeat(61))).not.toBeNull()
    expect(validateLotteryTitle(` ${'가'.repeat(60)} `)).toBeNull()
  })
})
