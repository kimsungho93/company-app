import { validateEmail } from './validate'

export const COMPANY_EMAIL_DOMAIN = '@ibslab.com'

export const NAME_MIN = 2
export const NAME_MAX = 10
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 20

const lengthOf = (value: string): number => [...value].length

export const validateSignupEmail = (value: string): string | null => {
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
  if (!value) return '비밀번호를 입력해 주세요.'

  const length = lengthOf(value)
  if (length < PASSWORD_MIN || length > PASSWORD_MAX) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하로 입력해 주세요.`
  }
  return null
}

export const validatePasswordConfirm = (password: string, confirm: string): string | null => {
  if (!confirm) return '비밀번호를 한 번 더 입력해 주세요.'
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.'
  return null
}
