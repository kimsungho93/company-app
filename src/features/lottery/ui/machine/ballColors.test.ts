import { describe, expect, it } from 'vitest'
import { BALL_COLORS, ballColor } from './ballColors'

describe('lottery ball colors', () => {
  it('assigns a distinct base color to each of the first fifteen people', () => {
    expect(BALL_COLORS).toHaveLength(15)
    expect(new Set(Array.from({ length: 15 }, (_, index) => ballColor(index))).size).toBe(15)
  })

  it('keeps fifty valid, distinct colors stable across repeated and reordered reads', () => {
    const colors = Array.from({ length: 50 }, (_, index) => ballColor(index))
    expect(new Set(colors).size).toBe(50)
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/)
    const reverseRead = Array.from({ length: 50 }, (_, index) => ballColor(49 - index)).reverse()
    expect(reverseRead).toEqual(colors)
  })

})
