import type { UserStatus } from '@/features/auth'
import { toErrorInfo } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { useUserApproval } from '../model/useUserApproval'
import type { PendingAction } from '../model/useUserApproval'
import { ApprovalToolbar } from './ApprovalToolbar'
import { UserApprovalRow } from './UserApprovalRow'
import styles from './UserApprovalList.module.scss'

const TABS: { status: UserStatus; label: string; empty: string }[] = [
  { status: 'PENDING', label: '승인 대기', empty: '승인 대기 중인 사람이 없습니다' },
  { status: 'APPROVED', label: '승인됨', empty: '승인된 사람이 없습니다' },

  { status: 'REJECTED', label: '거절됨', empty: '거절된 사람이 없습니다' },
]

const describe = ({ kind, targets }: PendingAction) => {
  const who =
    targets.length === 1 ? (
      <>
        <strong>{targets[0].name}</strong>({targets[0].email}) 님
      </>
    ) : (
      <>
        선택한 <strong>{targets.length}명</strong>
      </>
    )

  return kind === 'reject' ? (
    <>
      {who}의 로그인이 막히고 기존 세션이 모두 끊깁니다. 거절된 주소로는 다시 가입할 수 없어서,
      되돌리려면 <strong>거절됨 탭에서 다시 승인</strong>해야 합니다.
    </>
  ) : (
    <>{who}이 로그인할 수 있게 됩니다.</>
  )
}

interface UserApprovalListProps {
  currentUserId?: number
}

export const UserApprovalList = ({ currentUserId }: UserApprovalListProps) => {
  const {
    status, selected, pending, notice, rows, isFetching, error, refetch, loading, busy,
    allSelected, someSelected, selectedRows, selfSelected, canApprove, canReject,
    changeTab, toggleOne, toggleAll, run, setPending,
  } = useUserApproval(currentUserId)
  const tab = TABS.find((t) => t.status === status) ?? TABS[0]

  return (
    <div className={styles.card}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={t.status === status}
            className={t.status === status ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            disabled={busy}
            onClick={() => changeTab(t.status)}
          >
            {t.label}
            {t.status === 'PENDING' && status === 'PENDING' && rows.length > 0 && (
              <span className={styles.count}>{rows.length}</span>
            )}
          </button>
        ))}
      </div>

      {rows.length > 0 && (
        <ApprovalToolbar
          allSelected={allSelected}
          someSelected={someSelected}
          selectedCount={selectedRows.length}
          selfSelected={selfSelected}
          busy={busy}
          canApprove={canApprove}
          canReject={canReject}
          onToggleAll={toggleAll}
          onApprove={() => setPending({ kind: 'approve', targets: selectedRows })}
          onReject={() => setPending({ kind: 'reject', targets: selectedRows })}
        />
      )}

      {notice &&
        (notice.ok ? (
          <p className={styles.notice} role="status">
            {notice.text}
          </p>
        ) : (
          <div className={styles.failure} role="alert">
            <p className={styles.failureText}>{notice.text}</p>
            {notice.detail.length > 0 && (
              <ul className={styles.failureDetail}>
                {notice.detail.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

      <div className={styles.panel} role="tabpanel" aria-busy={isFetching}>
        {loading && <p className={styles.empty} role="status">불러오는 중…</p>}
        {error && (
          <div className={styles.failure} role="alert">
            <p>{toErrorInfo(error).message}</p>
            <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && <p className={styles.empty}>{tab.empty}</p>}

        {rows.map((user) => (
          <UserApprovalRow
            key={user.id}
            user={user}
            selected={selected.has(user.id)}
            isSelf={currentUserId === user.id}
            busy={busy}
            canApprove={canApprove}
            canReject={canReject}
            onSelect={() => toggleOne(user.id)}
            onApprove={() => setPending({ kind: 'approve', targets: [user] })}
            onReject={() => setPending({ kind: 'reject', targets: [user] })}
          />
        ))}
      </div>

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        title={
          pending === null
            ? ''
            : `${pending.targets.length > 1 ? `${pending.targets.length}명을 ` : ''}${
                pending.kind === 'reject' ? '거절' : '승인'
              }하시겠습니까?`
        }
        confirmLabel={pending?.kind === 'reject' ? '거절' : '승인'}
        tone={pending?.kind === 'reject' ? 'danger' : 'default'}
        description={pending && describe(pending)}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
