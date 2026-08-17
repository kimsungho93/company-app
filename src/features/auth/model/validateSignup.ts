import { validateEmail } from './validate'

// 전부 UX 용이다. 서버가 같은 제약을 독립적으로 다시 검증한다.
// 값을 바꿀 때는 docs/api/auth.md 를 같이 고칠 것.
export const COMPANY_EMAIL_DOMAIN = '@ibslab.com'

export const NAME_MIN = 2
export const NAME_MAX = 10
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 20

// 코드포인트 기준. String.length 는 서로게이트 페어를 2로 센다.
const lengthOf = (value: string): number => [...value].length

export const validateSignupEmail = (value: string): string | null => {
  // 형식을 먼저 본다. 순서가 반대면 'abc' 에 "회사 이메일로만 가입할 수 있습니다"가
  // 떠서 무엇이 잘못됐는지 알 수 없다.
  const formatError = validateEmail(value)
  if (formatError) return formatError

  if (!value.trim().toLowerCase().endsWith(COMPANY_EMAIL_DOMAIN)) {
    return `회사 이메일(${COMPANY_EMAIL_DOMAIN})로만 가입할 수 있습니다.`
  }
  return null
}

export const validateName = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '이름을 입력해 주세요.'

  const length = lengthOf(trimmed)
  if (length < NAME_MIN || length > NAME_MAX) {
    return `이름은 ${NAME_MIN}자 이상 ${NAME_MAX}자 이하로 입력해 주세요.`
  }
  return null
}

export const validateNewPassword = (value: string): string | null => {
  // 앞뒤 공백도 유효한 문자이므로 trim 하지 않는다
  if (!value) return '비밀번호를 입력해 주세요.'

  const length = lengthOf(value)
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하로 입력해 주세요.`
  }
  return null
}

export const validatePasswordConfirm = (
  password: string,
  confirm: string,
): string | null => {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요.'
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.'
  return null
}
