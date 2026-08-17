import { Link } from 'react-router'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { UserMenu } from './UserMenu'
import styles from './AppHeader.module.scss'

// 내비게이션 자리는 .spacer 여백뿐이다. 넣을 업무 메뉴가 아직 없어서
// MainNav 컴포넌트를 만들면 null 을 반환하는 빈 껍데기가 된다.
export const AppHeader = () => {
  return (
    <header className={styles.header}>
      {/*
        alt 를 비운다. 링크에 이미 aria-label 이 있어서 alt 를 채우면
        스크린리더가 "IBS 홈 IBS 홈" 으로 두 번 읽는다.
        width·height 를 박아 이미지 로드 전 레이아웃이 밀리지 않게 한다.
      */}
      <Link to="/" className={styles.logo} aria-label="IBS 홈">
        <img src="/logo-mark.png" alt="" width={32} height={32} className={styles.logoMark} />
        IBS
      </Link>

      <div className={styles.spacer} />

      <ThemeToggle />
      <UserMenu />
    </header>
  )
}
