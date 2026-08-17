import type { UserStatus } from '@/features/auth'

/** GET /api/admin/users?status= 의 항목 */
export interface AdminUser {
  id: number
  email: string
  name: string
  status: UserStatus
  /** 타임존 없는 ISO 문자열. 백엔드가 KST 기준으로 저장한다 */
  createdAt: string
}
