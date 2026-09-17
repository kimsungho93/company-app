export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface AdminUser {
  id: number
  email: string
  name: string
  status: UserStatus

  createdAt: string
}
