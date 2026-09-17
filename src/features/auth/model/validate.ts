const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8

export const validateEmail = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '이메일을 입력해 주세요.'
  if (!EMAIL_SHAPE.test(trimmed)) return '이메일 형식이 올바르지 않습니다.'
  return null
}

export const validatePassword = (value: string): string | null => {
  if (!value) return '비밀번호를 입력해 주세요.'
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  return null
}
