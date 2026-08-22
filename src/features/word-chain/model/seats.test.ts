import { describe, expect, it } from 'vitest'
import type { Player } from '../api/types'
import { splitSeats } from './seats'

const players = (count: number): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    userId: i + 1,
    name: `사람${i + 1}`,
    avatar: null,
    ready: false,
  }))

describe('splitSeats', () => {
  it('5명 이하면 앞줄만 쓴다', () => {
    const { back, front } = splitSeats(players(5))

    expect(back).toHaveLength(0)
    expect(front).toHaveLength(5)
  })

  it('아무도 없으면 둘 다 비어 있다', () => {
    expect(splitSeats([])).toEqual({ back: [], front: [] })
  })

  it('6명이면 반씩 나눈다', () => {
    const { back, front } = splitSeats(players(6))

    expect(back.map((p) => p.userId)).toEqual([1, 2, 3])
    expect(front.map((p) => p.userId)).toEqual([4, 5, 6])
  })

  it('7명이면 뒷줄이 하나 적다', () => {
    const { back, front } = splitSeats(players(7))

    expect(back).toHaveLength(3)
    expect(front).toHaveLength(4)
  })

  it('10명이면 5 · 5 다', () => {
    const { back, front } = splitSeats(players(10))

    expect(back.map((p) => p.userId)).toEqual([1, 2, 3, 4, 5])
    expect(front.map((p) => p.userId)).toEqual([6, 7, 8, 9, 10])
  })

  it('받은 순서를 바꾸지 않는다', () => {
    const { back, front } = splitSeats(players(8))

    expect([...back, ...front].map((p) => p.userId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
