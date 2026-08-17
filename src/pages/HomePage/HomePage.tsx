import { useLogout } from '@/features/auth'
import { Button } from '@/shared/ui/Button'
import styles from './HomePage.module.scss'

export const HomePage = () => {
  const { logout, isLoading } = useLogout()

  return (
    <>
      <title>홈 · IBS</title>
      <main className={styles.page}>
        <h1 className={styles.title}>환영합니다</h1>
        <div className={styles.actions}>
          <Button type="button" loading={isLoading} onClick={logout}>
            로그아웃
          </Button>
        </div>
      </main>
    </>
  )
}
