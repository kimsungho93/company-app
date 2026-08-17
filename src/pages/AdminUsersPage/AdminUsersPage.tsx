import { UserApprovalList } from '@/features/admin'
import styles from './AdminUsersPage.module.scss'

export const AdminUsersPage = () => {
  return (
    <>
      <title>승인 관리 · IBS</title>
      <h1 className={styles.title}>승인 관리</h1>
      <UserApprovalList />
    </>
  )
}
