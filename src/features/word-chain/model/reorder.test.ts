import { describe, expect, it } from 'vitest'
import { applyOrder, moveTo, sameOrder } from './reorder'

describe('moveTo', () => {
  it('앞으로 옮기면 나머지가 뒤로 밀린다', () => {
    expect(moveTo([1, 2, 3, 4], 4, 1)).toEqual([1, 4, 2, 3])
  })

  it('뒤로 옮기면 나머지가 앞으로 당겨진다', () => {
    expect(moveTo([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4])
  })

  it('범위를 벗어난 자리는 양 끝으로 묶는다', () => {
    expect(moveTo([1, 2, 3], 3, 99)).toEqual([1, 2, 3])
    expect(moveTo([1, 2, 3], 3, -5)).toEqual([3, 1, 2])
  })

  it('제자리면 같은 배열을 그대로 돌려준다', () => {
    const order = [1, 2, 3]

    expect(moveTo(order, 2, 1)).toBe(order)
  })

  it('없는 사람은 아무것도 안 바꾼다', () => {
    const order = [1, 2, 3]

    expect(moveTo(order, 9, 0)).toBe(order)
  })
})

describe('sameOrder', () => {
  it('자리까지 같아야 같다', () => {
    expect(sameOrder([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(sameOrder([1, 2, 3], [1, 3, 2])).toBe(false)
    expect(sameOrder([1, 2], [1, 2, 3])).toBe(false)
  })
})

describe('applyOrder', () => {
  const players = [{ userId: 1 }, { userId: 2 }, { userId: 3 }]

  it('주어진 순서대로 세운다', () => {
    expect(applyOrder(players, [3, 1, 2]).map((p) => p.userId)).toEqual([3, 1, 2])
  })

  it('순서에 없는 사람은 원래 상대 순서로 뒤에 붙인다', () => {
    expect(applyOrder(players, [3]).map((p) => p.userId)).toEqual([3, 1, 2])
  })

  it('빠진 사람이 순서에 남아 있어도 넘어간다', () => {
    expect(applyOrder(players, [9, 2]).map((p) => p.userId)).toEqual([2, 1, 3])
  })
})
