// 이메일만 기억한다. 자격 증명이 아니라 식별자다.
// 비밀번호나 토큰을 여기 넣지 말 것 — access token 은 메모리, refresh 는 httpOnly 쿠키다.
const KEY = 'ibs.auth.rememberedEmail'

// 프라이빗 모드나 스토리지 차단 환경에서는 접근 자체가 던진다.
// 기억하지 못하는 것은 로그인을 막을 이유가 되지 않는다.
export const loadRememberedEmail = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const saveRememberedEmail = (email: string): void => {
  try {
    localStorage.setItem(KEY, email)
  } catch {
    return
  }
}

export const clearRememberedEmail = (): void => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
