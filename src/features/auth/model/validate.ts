// 서버가 최종 판단하므로 프론트는 명백한 오타만 거른다.
// RFC 5322 전체를 흉내 내려 하면 유효한 주소를 거부하는 쪽이 더 큰 문제가 된다.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8

export const validateEmail = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '이메일을 입력해 주세요.'
  if (!EMAIL_SHAPE.test(trimmed)) return '이메일 형식이 올바르지 않습니다.'
  return null
}

export const validatePassword = (value: string): string | null => {
  // 앞뒤 공백도 유효한 문자이므로 trim 하지 않는다
  if (!value) return '비밀번호를 입력해 주세요.'
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`
  }
  return null
}
