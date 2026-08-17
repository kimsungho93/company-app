export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  /** 초 단위 잔여 유효 시간 */
  expiresIn: number
}
