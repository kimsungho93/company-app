import { Link } from 'react-router'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { UserMenu } from './UserMenu'
import styles from './AppHeader.module.scss'

// 내비게이션 자리는 .spacer 여백뿐이다. 넣을 업무 메뉴가 아직 없어서
// MainNav 컴포넌트를 만들면 null 을 반환하는 빈 껍데기가 된다.
export const AppHeader = () => {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logo} aria-label="IBS 홈">
        IBS
      </Link>

      <div className={styles.spacer} />

      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
