import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, validateEmail, validatePassword } from './validate'

describe('validateEmail', () => {
  it('정상적인 주소는 통과한다', () => {
    expect(validateEmail('tiger@ibslab.com')).toBeNull()
    expect(validateEmail('a.b+tag@sub.example.co.kr')).toBeNull()
  })

  it('앞뒤 공백은 무시한다', () => {
    expect(validateEmail('  tiger@ibslab.com  ')).toBeNull()
  })

  it('빈 값과 공백만 있는 값을 거른다', () => {
    expect(validateEmail('')).toBe('이메일을 입력해 주세요.')
    expect(validateEmail('   ')).toBe('이메일을 입력해 주세요.')
  })

  it('형식이 어긋난 값을 거른다', () => {
    expect(validateEmail('tiger')).not.toBeNull()
    expect(validateEmail('tiger@')).not.toBeNull()
    expect(validateEmail('tiger@ibslab')).not.toBeNull()
    expect(validateEmail('tiger @ibslab.com')).not.toBeNull()
  })
})

describe('validatePassword', () => {
  it('길이를 채우면 통과한다', () => {
    expect(validatePassword('password1234')).toBeNull()
  })

  it('빈 값을 거른다', () => {
    expect(validatePassword('')).toBe('비밀번호를 입력해 주세요.')
  })

  it('최소 길이 미만을 거른다', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull()
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })

  it('공백도 유효한 문자로 세어 trim 하지 않는다', () => {
    expect(validatePassword('        ')).toBeNull()
  })
})
