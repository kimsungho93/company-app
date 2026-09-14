import { Link } from 'react-router'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { MainNav } from './MainNav'
import { UserMenu } from './UserMenu'
import styles from './AppHeader.module.scss'

export const AppHeader = () => {
  return (
    <header className={styles.header}>

      <div className={styles.side}>
        <Link to="/" className={styles.logo} aria-label="아이비에스 홈">
          <img src="/logo-mark.png" alt="" width={32} height={32} className={styles.logoMark} />
          아이비에스
        </Link>
      </div>

      <MainNav />

      <div className={`${styles.side} ${styles.sideEnd}`}>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
