import { describe, expect, it } from 'vitest'
import { summarizeResults } from './summarizeResults'

const ok = (): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value: undefined })

const fail = (message: string): PromiseSettledResult<unknown> => ({
  status: 'rejected',
  reason: { status: 404, data: { code: 'USER_NOT_FOUND', message } },
})

const people = (...names: string[]) => names.map((name) => ({ name }))

describe('summarizeResults', () => {
  it('전부 성공하면 개수만 알린다', () => {
    const notice = summarizeResults(people('이영희', '박철수'), [ok(), ok()], '승인')

    expect(notice).toEqual({ ok: true, text: '2명을 승인했습니다.', detail: [] })
  })

  // '1명 중 1명 실패' 는 아무것도 알려주지 않는다
  it('단건 실패는 서버가 준 사유를 그대로 보여준다', () => {
    const notice = summarizeResults(people('이영희'), [fail('사용자를 찾을 수 없습니다.')], '승인')

    expect(notice.ok).toBe(false)
    expect(notice.text).toBe('사용자를 찾을 수 없습니다.')
    expect(notice.detail).toEqual([])
  })

  it('일부 실패하면 성공 수와 실패한 사람을 함께 알린다', () => {
    const notice = summarizeResults(
      people('이영희', '박철수', '최민수'),
      [ok(), fail('사용자를 찾을 수 없습니다.'), ok()],
      '승인',
    )

    expect(notice.ok).toBe(false)
    expect(notice.text).toBe('2명을 승인했습니다. 1명은 처리하지 못했습니다.')
    expect(notice.detail).toEqual(['사용자를 찾을 수 없습니다. — 박철수'])
  })

  it('사유가 같으면 한 줄로 묶는다', () => {
    const notice = summarizeResults(
      people('이영희', '박철수'),
      [fail('사용자를 찾을 수 없습니다.'), fail('사용자를 찾을 수 없습니다.')],
      '거절',
    )

    expect(notice.text).toBe('2명 모두 거절하지 못했습니다.')
    expect(notice.detail).toEqual(['사용자를 찾을 수 없습니다. — 이영희, 박철수'])
  })

  it('사유가 다르면 줄을 나눈다', () => {
    const notice = summarizeResults(
      people('이영희', '박철수', '최민수'),
      [ok(), fail('사용자를 찾을 수 없습니다.'), fail('권한이 없습니다.')],
      '승인',
    )

    expect(notice.detail).toEqual([
      '사용자를 찾을 수 없습니다. — 박철수',
      '권한이 없습니다. — 최민수',
    ])
  })

  // 전체 선택으로 수십 명이 실패하면 이름이 화면을 덮는다
  it('이름이 다섯을 넘으면 접는다', () => {
    const names = ['가', '나', '다', '라', '마', '바', '사']
    const notice = summarizeResults(
      people(...names),
      names.map(() => fail('사용자를 찾을 수 없습니다.')),
      '승인',
    )

    expect(notice.detail).toEqual(['사용자를 찾을 수 없습니다. — 가, 나, 다, 라, 마 외 2명'])
  })
})
