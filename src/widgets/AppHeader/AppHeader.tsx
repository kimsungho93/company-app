import { Link } from 'react-router'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { AdminLink } from './AdminLink'
import { MainNav } from './MainNav'
import { UserMenu } from './UserMenu'
import styles from './AppHeader.module.scss'

export const AppHeader = () => {
  return (
    <header className={styles.header}>
      {/*
        alt 를 비운다. 링크에 이미 aria-label 이 있어서 alt 를 채우면
        스크린리더가 "IBS 홈 IBS 홈" 으로 두 번 읽는다.
        width·height 를 박아 이미지 로드 전 레이아웃이 밀리지 않게 한다.
      */}
      <Link to="/" className={styles.logo} aria-label="아이비에스 홈">
        <img src="/logo-mark.png" alt="" width={32} height={32} className={styles.logoMark} />
        아이비에스
      </Link>

      <MainNav />

      <div className={styles.spacer} />

      <AdminLink />
      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
