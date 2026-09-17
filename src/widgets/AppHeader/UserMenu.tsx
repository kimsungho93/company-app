import { useState } from 'react'
import { useLogout, useMeQuery } from '@/features/auth'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import styles from './AppHeader.module.scss'

export const UserMenu = () => {
  const { data: me } = useMeQuery()
  const { logout, isLoading } = useLogout()
  const [asking, setAsking] = useState(false)

  return (
    <div className={styles.user}>
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
