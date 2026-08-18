import { describe, expect, it } from 'vitest'
import { findConflict } from './conflict'
import type { LeaveEntry } from './types'

const 박철수_연차 = {
  id: 1,
  name: '박철수',
  kind: '연차',
  startDate: '2026-08-18',
  endDate: '2026-08-21',
} satisfies LeaveEntry

const ENTRIES: LeaveEntry[] = [
  박철수_연차,
  { id: 2, name: '이영희', kind: '오전반차', startDate: '2026-08-19', endDate: '2026-08-19' },
]

describe('findConflict', () => {
  it('겹치는 것이 없으면 null 이다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '박철수',
        kind: '공가',
        startDate: '2026-08-25',
        endDate: '2026-08-25',
      }),
    ).toBeNull()
  })

  it('다른 사람이면 같은 날이어도 겹치지 않는다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '김성호',
        kind: '연차',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
      }),
    ).toBeNull()
  })

  it('같은 사람의 기간 안에 하루가 들어가면 겹친다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '박철수',
        kind: '오전반차',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
      }),
    ).toEqual(박철수_연차)
  })

  it('같은 날 오전반차와 오후반차도 겹친다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '이영희',
        kind: '오후반차',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
      }),
    ).not.toBeNull()
  })

  it('기존 기간을 감싸도 겹친다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '박철수',
        kind: '연차',
        startDate: '2026-08-10',
        endDate: '2026-08-31',
      }),
    ).toEqual(박철수_연차)
  })

  it('끝나는 날과 시작하는 날이 같으면 겹친다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '박철수',
        kind: '공가',
        startDate: '2026-08-21',
        endDate: '2026-08-23',
      }),
    ).toEqual(박철수_연차)
  })

  it('하루 차이로 붙어 있으면 겹치지 않는다', () => {
    expect(
      findConflict(ENTRIES, {
        name: '박철수',
        kind: '공가',
        startDate: '2026-08-22',
        endDate: '2026-08-23',
      }),
    ).toBeNull()
  })
})
