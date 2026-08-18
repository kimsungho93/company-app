import { useMeQuery } from '@/features/auth'
import { LeaveCalendar } from '@/features/leave'
import styles from './LeavePage.module.scss'

export const LeavePage = () => {
  const { data: me } = useMeQuery()

  return (
    <>
      <title>휴가 · IBS</title>
      <h1 className={styles.title}>휴가</h1>
      <LeaveCalendar userName={me?.name} isAdmin={me?.role === 'ADMIN'} />
    </>
  )
}
