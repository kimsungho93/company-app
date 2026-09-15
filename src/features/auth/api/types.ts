export interface LoginRequest {
  email: string
  password: string
}

import type { SessionMetadata } from '@/shared/api'

export interface LoginResponse extends Partial<SessionMetadata> {
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
