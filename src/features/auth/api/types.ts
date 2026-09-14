export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string

  expiresIn: number
}

export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Me {
  id: number
  email: string
  name: string
  role: Role
  status: UserStatus
}
