import { Checkbox } from '@/shared/ui/Checkbox'
import type { AdminUser } from '../api/types'
import { formatJoinedAt } from '../model/formatJoinedAt'
import styles from './UserApprovalList.module.scss'

interface UserApprovalRowProps {
  user: AdminUser
  selected: boolean
  isSelf: boolean
  busy: boolean
  canApprove: boolean
  canReject: boolean
  onSelect: () => void
  onApprove: () => void
  onReject: () => void
}

export const UserApprovalRow = ({
  user,
  selected,
  isSelf,
  busy,
  canApprove,
  canReject,
  onSelect,
  onApprove,
  onReject,
}: UserApprovalRowProps) => (
  <div className={styles.row}>
    <Checkbox
      label={`${user.name} 선택`}
      labelHidden
      checked={selected}
      disabled={busy}
      onChange={onSelect}
    />

    <div className={styles.info}>
      <div className={styles.name}>
        {user.name}
        {isSelf && <span className={styles.selfTag}>나</span>}
      </div>
      <div className={styles.meta}>
        {user.email} · {formatJoinedAt(user.createdAt)}
      </div>
    </div>

    <div className={styles.actions}>
      {canApprove && (
        <button type="button" className={styles.approve} disabled={busy} onClick={onApprove}>
          승인
        </button>
      )}
      {canReject && (
        <button
          type="button"
          className={styles.reject}

          disabled={busy || isSelf}
          onClick={onReject}
        >
          거절
        </button>
      )}
    </div>
  </div>
)
