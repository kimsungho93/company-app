import { Checkbox } from '@/shared/ui/Checkbox'
import styles from './UserApprovalList.module.scss'

interface ApprovalToolbarProps {
  allSelected: boolean
  someSelected: boolean
  selectedCount: number
  selfSelected: boolean
  busy: boolean
  canApprove: boolean
  canReject: boolean
  onToggleAll: () => void
  onApprove: () => void
  onReject: () => void
}

export const ApprovalToolbar = ({
  allSelected, someSelected, selectedCount, selfSelected, busy,
  canApprove, canReject, onToggleAll, onApprove, onReject,
}: ApprovalToolbarProps) => (
  <div className={styles.toolbar}>
    <Checkbox
      label="전체 선택"
      checked={allSelected}
      indeterminate={someSelected}
      disabled={busy}
      onChange={onToggleAll}
    />

    {selectedCount > 0 && (
      <>
        <span className={styles.selectedCount}>{selectedCount}명 선택</span>
        <span className={styles.toolbarSpacer} />

        {selfSelected && canReject && (
          <span className={styles.hint}>본인은 거절할 수 없습니다</span>
        )}

        {canApprove && (
          <button
            type="button"
            className={styles.approve}
            disabled={busy}
            onClick={onApprove}
          >
            일괄 승인
          </button>
        )}
        {canReject && (
          <button
            type="button"
            className={styles.reject}
            disabled={busy || selfSelected}
            onClick={onReject}
          >
            일괄 거절
          </button>
        )}
      </>
    )}
  </div>
)
