import { describe, expect, it } from 'vitest'
import { formatJoinedAt } from './formatJoinedAt'

describe('formatJoinedAt', () => {
  // Jackson 기본값이 이 형식이다. 문자열을 그대로 자르면 22:11 이 떠서
  // 실제 가입 시각(다음 날 07:11)과 9시간 어긋난다.
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

  // 파싱 실패에 화면이 깨지는 것보다 원문이 보이는 편이 낫다
  it('해석할 수 없으면 원문을 그대로 돌려준다', () => {
    expect(formatJoinedAt('알 수 없음')).toBe('알 수 없음')
  })
})
