import { useState } from 'react'
import { useLogout, useMeQuery } from '@/features/auth'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import styles from './AppHeader.module.scss'

// 드롭다운으로 만들지 않는다. 항목이 이름과 로그아웃 둘뿐인데
// aria-expanded·Escape·포커스 트랩을 직접 챙길 이유가 없다.
export const UserMenu = () => {
  const { data: me } = useMeQuery()
  const { logout, isLoading } = useLogout()
  const [asking, setAsking] = useState(false)

  return (
    <div className={styles.user}>
      {/* me 가 오기 전에도 자리를 차지해야 옆 요소가 밀리지 않는다 */}
      <span className={styles.userName} data-testid="user-name">
        {me?.name ?? ''}
      </span>
      <button
        type="button"
        className={styles.logout}
        disabled={isLoading}
        aria-busy={isLoading}
        onClick={() => setAsking(true)}
      >
        로그아웃
      </button>

      <ConfirmDialog
        open={asking}
        busy={isLoading}
        title="로그아웃하시겠습니까?"
        confirmLabel="로그아웃"
        onConfirm={() => {
          setAsking(false)
          void logout()
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  )
}
