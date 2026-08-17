import { useState } from 'react'
import { useMeQuery } from '@/features/auth'
import type { UserStatus } from '@/features/auth'
import { toErrorInfo } from '@/shared/api'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  useAdminUsersQuery,
  useApproveUserMutation,
  useRejectUserMutation,
} from '../api/adminUsersApi'
import type { AdminUser } from '../api/types'
import { formatJoinedAt } from '../model/formatJoinedAt'
import styles from './UserApprovalList.module.scss'

const TABS: { status: UserStatus; label: string; empty: string }[] = [
  { status: 'PENDING', label: '승인 대기', empty: '승인 대기 중인 사람이 없습니다' },
  { status: 'APPROVED', label: '승인됨', empty: '승인된 사람이 없습니다' },
  // 실수로 거절했을 때 되돌릴 유일한 통로다. 거절해도 users 행이 남아
  // 당사자는 같은 주소로 재가입할 수 없다.
  { status: 'REJECTED', label: '거절됨', empty: '거절된 사람이 없습니다' },
]

interface PendingAction {
  kind: 'approve' | 'reject'
  user: AdminUser
}

export const UserApprovalList = () => {
  const [status, setStatus] = useState<UserStatus>('PENDING')
  const [pending, setPending] = useState<PendingAction | null>(null)

  const { data: me } = useMeQuery()
  const { data: users, isFetching } = useAdminUsersQuery(status)
  const [approve, approveState] = useApproveUserMutation()
  const [reject, rejectState] = useRejectUserMutation()

  const busy = approveState.isLoading || rejectState.isLoading
  const tab = TABS.find((t) => t.status === status) ?? TABS[0]
  const failure = approveState.error ?? rejectState.error

  const run = async () => {
    if (!pending) return
    const mutate = pending.kind === 'approve' ? approve : reject
    try {
      await mutate(pending.user.id).unwrap()
    } catch {
      // 실패는 아래 failure 로 화면에 드러난다
    }
    setPending(null)
  }

  return (
    <div>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={t.status === status}
            className={t.status === status ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setStatus(t.status)}
          >
            {t.label}
            {t.status === 'PENDING' && status === 'PENDING' && users && users.length > 0 && (
              <span className={styles.count}>{users.length}</span>
            )}
          </button>
        ))}
      </div>

      {failure && (
        <p className={styles.failure} role="alert">
          {toErrorInfo(failure).message}
        </p>
      )}

      <div className={styles.panel} role="tabpanel" aria-busy={isFetching}>
        {users?.length === 0 && <p className={styles.empty}>{tab.empty}</p>}

        {users?.map((user) => (
          <div key={user.id} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>
                {user.name}
                {me?.id === user.id && <span className={styles.selfTag}>나</span>}
              </div>
              <div className={styles.meta}>
                {user.email} · {formatJoinedAt(user.createdAt)}
              </div>
            </div>

            <div className={styles.actions}>
              {status !== 'APPROVED' && (
                <button
                  type="button"
                  className={styles.approve}
                  disabled={busy}
                  onClick={() => setPending({ kind: 'approve', user })}
                >
                  승인
                </button>
              )}

              {status !== 'REJECTED' && (
                <button
                  type="button"
                  className={styles.reject}
                  // 백엔드가 CANNOT_REJECT_SELF 로 400 을 준다. 미리 막는다.
                  disabled={busy || me?.id === user.id}
                  onClick={() => setPending({ kind: 'reject', user })}
                >
                  거절
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        title={pending?.kind === 'reject' ? '거절하시겠습니까?' : '승인하시겠습니까?'}
        confirmLabel={pending?.kind === 'reject' ? '거절' : '승인'}
        tone={pending?.kind === 'reject' ? 'danger' : 'default'}
        description={
          pending && (
            <>
              <strong>{pending.user.name}</strong>({pending.user.email}) 님
              {pending.kind === 'reject' ? (
                <>
                  의 로그인이 막히고 기존 세션이 모두 끊깁니다. 거절된 주소로는 다시 가입할 수
                  없어서, 되돌리려면 <strong>거절됨 탭에서 다시 승인</strong>해야 합니다.
                </>
              ) : (
                <>이 로그인할 수 있게 됩니다.</>
              )}
            </>
          )
        }
        onConfirm={run}
        onCancel={() => setPending(null)}
      />

      {/* 행이 사라지는 것만으로는 스크린리더에 전달되지 않는다 */}
      <p role="status" className="visually-hidden">
        {approveState.isSuccess && '승인했습니다.'}
        {rejectState.isSuccess && '거절했습니다.'}
      </p>
    </div>
  )
}
