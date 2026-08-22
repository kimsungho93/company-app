import { describe, expect, it } from 'vitest'
import { validateRoomName } from './validateRoomName'

describe('validateRoomName', () => {
  it('보통 이름은 통과한다', () => {
    expect(validateRoomName('점심내기 한판')).toBeNull()
  })

  it('비어 있으면 막는다', () => {
    expect(validateRoomName('')).toBe('방 이름을 입력해 주세요.')
  })

  it('공백만 있으면 막는다', () => {
    expect(validateRoomName('   ')).toBe('방 이름을 입력해 주세요.')
  })

  it('29자까지 통과한다', () => {
    expect(validateRoomName('가'.repeat(29))).toBeNull()
  })

  it('30자부터 막는다', () => {
    expect(validateRoomName('가'.repeat(30))).toBe('방 이름은 29자까지 입력할 수 있습니다.')
  })

  it('길이는 앞뒤 공백을 뺀 뒤에 센다', () => {
    expect(validateRoomName(`  ${'가'.repeat(29)}  `)).toBeNull()
  })
})
