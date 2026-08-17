import { describe, expect, it } from 'vitest'
import {
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateName,
  validateNewPassword,
  validatePasswordConfirm,
  validateSignupEmail,
} from './validateSignup'

describe('validateSignupEmail', () => {
  it('회사 도메인이면 통과한다', () => {
    expect(validateSignupEmail('tiger@ibslab.com')).toBeNull()
  })

  it('도메인 대소문자를 무시한다', () => {
    expect(validateSignupEmail('Tiger@IBSLAB.COM')).toBeNull()
  })

  it('다른 도메인을 거른다', () => {
    expect(validateSignupEmail('tiger@gmail.com')).toContain('@ibslab.com')
  })

  it('형식 오류를 도메인 오류보다 먼저 알린다', () => {
    // 순서가 반대면 'abc' 에 "회사 이메일로만" 이 떠서 무엇이 틀렸는지 알 수 없다
    expect(validateSignupEmail('abc')).toBe('이메일 형식이 올바르지 않습니다.')
  })

  it('빈 값을 거른다', () => {
    expect(validateSignupEmail('')).toBe('이메일을 입력해 주세요.')
  })
})

describe('validateName', () => {
  it('경계값을 정확히 판정한다', () => {
    expect(validateName('가')).not.toBeNull() // 1자
    expect(validateName('가나')).toBeNull() // 2자 = NAME_MIN
    expect(validateName('가'.repeat(NAME_MAX))).toBeNull() // 10자 = NAME_MAX
    expect(validateName('가'.repeat(NAME_MAX + 1))).not.toBeNull() // 11자
  })

  it('앞뒤 공백을 제거하고 센다', () => {
    expect(validateName('  홍길동  ')).toBeNull()
    expect(validateName('   ')).toBe('이름을 입력해 주세요.')
  })

  it('이모지를 한 글자로 센다', () => {
    // String.length 로 세면 서로게이트 페어가 2로 잡혀 10자 제한에 일찍 걸린다
    expect(validateName('😀'.repeat(NAME_MAX))).toBeNull()
    expect(validateName('😀'.repeat(NAME_MAX + 1))).not.toBeNull()
  })

  it('안내 문구에 실제 범위가 들어간다', () => {
    expect(validateName('가')).toBe(`이름은 ${NAME_MIN}자 이상 ${NAME_MAX}자 이하로 입력해 주세요.`)
  })
})

describe('validateNewPassword', () => {
  it('경계값을 정확히 판정한다', () => {
    expect(validateNewPassword('a'.repeat(PASSWORD_MIN - 1))).not.toBeNull() // 7자
    expect(validateNewPassword('a'.repeat(PASSWORD_MIN))).toBeNull() // 8자
    expect(validateNewPassword('a'.repeat(PASSWORD_MAX))).toBeNull() // 20자
    expect(validateNewPassword('a'.repeat(PASSWORD_MAX + 1))).not.toBeNull() // 21자
  })

  it('공백도 유효한 문자로 세어 trim 하지 않는다', () => {
    expect(validateNewPassword('        ')).toBeNull()
  })

  it('빈 값을 거른다', () => {
    expect(validateNewPassword('')).toBe('비밀번호를 입력해 주세요.')
  })
})

describe('validatePasswordConfirm', () => {
  it('일치하면 통과한다', () => {
    expect(validatePasswordConfirm('password1234', 'password1234')).toBeNull()
  })

  it('불일치를 잡는다', () => {
    expect(validatePasswordConfirm('password1234', 'password12345')).toBe(
      '비밀번호가 일치하지 않습니다.',
    )
  })

  it('빈 확인값을 거른다', () => {
    expect(validatePasswordConfirm('password1234', '')).toBe('비밀번호를 한 번 더 입력해 주세요.')
  })
})
