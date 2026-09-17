import { describe, expect, it } from 'vitest'
import { formatJoinedAt } from './formatJoinedAt'

describe('formatJoinedAt', () => {
  it('UTC ISO 문자열을 KST 로 옮긴다', () => {
    expect(formatJoinedAt('2026-08-17T22:11:11Z')).toBe('2026-08-18 07:11:11')
  })

  it('소수점 이하가 붙어도 초까지만 보여준다', () => {
    expect(formatJoinedAt('2026-08-17T22:11:11.482913Z')).toBe('2026-08-18 07:11:11')
  })

  it('오프셋이 명시돼 있으면 그것을 존중한다', () => {
    expect(formatJoinedAt('2026-08-18T07:11:11+09:00')).toBe('2026-08-18 07:11:11')
  })

  it('자정을 넘겨도 날짜가 함께 넘어간다', () => {
    expect(formatJoinedAt('2026-08-17T15:00:00Z')).toBe('2026-08-18 00:00:00')
  })

  it('한 자리 수를 0 으로 채운다', () => {
    expect(formatJoinedAt('2026-01-02T00:03:04Z')).toBe('2026-01-02 09:03:04')
  })

  it('해석할 수 없으면 원문을 그대로 돌려준다', () => {
    expect(formatJoinedAt('알 수 없음')).toBe('알 수 없음')
  })
})
