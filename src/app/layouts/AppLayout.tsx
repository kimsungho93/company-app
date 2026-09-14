import { Outlet } from 'react-router'
import { useRejectedGuard } from '@/features/auth'
import { AppHeader } from '@/widgets/AppHeader'
import styles from './AppLayout.module.scss'

export const AppLayout = () => {
  useRejectedGuard()

  return (
    <div className={styles.shell}>
      <AppHeader />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
