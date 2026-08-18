import { Link } from 'react-router'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
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
      {/*
        좌우를 같은 비율로 늘려 가운데 MainNav 가 화면 정중앙에 오게 한다.
        로고와 오른쪽 묶음의 폭이 달라서, 그냥 나열하면 메뉴가 한쪽으로 쏠린다.
      */}
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
