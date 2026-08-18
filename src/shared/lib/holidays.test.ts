import { describe, expect, it } from 'vitest'
import { holidayNameOf } from './holidays'

describe('holidayNameOf', () => {
  it('양력 고정 공휴일을 찾는다', () => {
    expect(holidayNameOf('2026-08-15')).toBe('광복절')
    expect(holidayNameOf('2026-01-01')).toBe('신정')
    expect(holidayNameOf('2027-12-25')).toBe('성탄절')
  })

  it('공휴일이 아니면 null 이다', () => {
    expect(holidayNameOf('2026-08-14')).toBeNull()
  })

  it('음력 공휴일은 아직 담고 있지 않다', () => {
    const lunarNames = ['설날', '추석', '부처님오신날']
    const found = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(2026, 0, 1 + i)
      return holidayNameOf(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      )
    }).filter((name): name is string => name !== null)

    expect(found.some((name) => lunarNames.includes(name))).toBe(false)
  })
})
