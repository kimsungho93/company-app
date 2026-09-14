import type { UserStatus } from '@/features/auth'

export interface AdminUser {
  id: number
  email: string
  name: string
  status: UserStatus

  createdAt: string
}
