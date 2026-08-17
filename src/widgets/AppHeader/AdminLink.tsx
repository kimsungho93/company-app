import { NavLink } from 'react-router'
import { useMeQuery } from '@/features/auth'
import styles from './AppHeader.module.scss'

// 여기서 숨기는 것은 화면 정리일 뿐 보안이 아니다.
// 실제 차단은 백엔드 AdminUserService.verifyAdmin 이 매 요청 DB 로 한다.
export const AdminLink = () => {
  const { data: me } = useMeQuery()

  if (me?.role !== 'ADMIN') return null

  // <nav> 를 AppHeader 가 아니라 여기 둔다. 헤더에 두면 일반 사용자에게
  // 빈 랜드마크가 남아 스크린리더가 빈 '관리' 영역을 읽는다.
  // NavLink 는 현재 경로일 때 aria-current="page" 를 알아서 붙인다.
  return (
    <nav aria-label="관리">
      <NavLink
        to="/admin/users"
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
        }
      >
        승인 관리
      </NavLink>
    </nav>
  )
}
