import { Outlet } from 'react-router'
import { useRejectedGuard } from '@/features/auth'
import { AppHeader } from '@/widgets/AppHeader'
import styles from './AppLayout.module.scss'

// 헤더를 여기서 소유한다. 각 페이지가 따로 렌더하면 라우트 이동마다
// 언마운트·재마운트되어 포커스와 열린 UI 상태가 날아간다.
// AuthLayout 이 WaferCanvas 를 소유하는 것과 같은 이유다.
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
