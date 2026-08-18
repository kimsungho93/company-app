import { describe, expect, it } from 'vitest'
import { monthGrid, toIsoDate } from './monthGrid'

describe('monthGrid', () => {
  it('달과 무관하게 항상 6주 42칸이다', () => {
    for (const month of [1, 2, 8, 12]) {
      const grid = monthGrid(2026, month)
      expect(grid).toHaveLength(6)
      expect(grid.flat()).toHaveLength(42)
    }
  })

  it('모든 주가 일요일에서 시작해 토요일에 끝난다', () => {
    for (const week of monthGrid(2026, 8)) {
      expect(week[0].weekday).toBe(0)
      expect(week[6].weekday).toBe(6)
    }
  })

  it('이번 달 날짜만 inMonth 다', () => {
    const inMonth = monthGrid(2026, 8).flat().filter((d) => d.inMonth)

    expect(inMonth).toHaveLength(31)
    expect(inMonth[0].iso).toBe('2026-08-01')
    expect(inMonth[30].iso).toBe('2026-08-31')
  })

  it('앞뒤 빈칸을 이웃 달 날짜로 메운다', () => {
    const grid = monthGrid(2026, 8)
    const before = grid.flat().filter((d) => !d.inMonth && d.iso < '2026-08')

    expect(before.at(-1)?.iso).toBe('2026-07-31')
  })

  it('윤년 2월을 정확히 센다', () => {
    const inMonth = monthGrid(2028, 2).flat().filter((d) => d.inMonth)

    expect(inMonth).toHaveLength(29)
    expect(inMonth.at(-1)?.iso).toBe('2028-02-29')
  })

  it('해를 넘겨도 이어진다', () => {
    const grid = monthGrid(2026, 12)
    const after = grid.flat().filter((d) => !d.inMonth && d.iso > '2026-12')

    expect(after[0].iso).toBe('2027-01-01')
  })
})

describe('toIsoDate', () => {
  it('UTC 로 넘기지 않고 지역 날짜를 그대로 쓴다', () => {
    expect(toIsoDate(new Date(2026, 7, 13, 0, 0, 0))).toBe('2026-08-13')
    expect(toIsoDate(new Date(2026, 7, 13, 23, 59, 59))).toBe('2026-08-13')
  })

  it('한 자리 월·일을 0 으로 채운다', () => {
    expect(toIsoDate(new Date(2026, 0, 2))).toBe('2026-01-02')
  })
})
