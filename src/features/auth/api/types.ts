export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  /** 초 단위 잔여 유효 시간 */
  expiresIn: number
}

export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/** GET /api/users/me */
export interface Me {
  id: number
  email: string
  name: string
  role: Role
  status: UserStatus
}
