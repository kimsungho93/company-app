import { useState } from 'react'
import { useMeQuery } from '@/features/auth'
import type { UserStatus } from '@/features/auth'
import { toErrorInfo } from '@/shared/api'
import { Checkbox } from '@/shared/ui/Checkbox'
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

type ActionKind = 'approve' | 'reject'

interface PendingAction {
  kind: ActionKind
  /** 단건도 배열로 통일한다. 확인창과 실행 경로가 갈라지지 않는다 */
  targets: AdminUser[]
}

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

export const UserApprovalList = () => {
  const [status, setStatus] = useState<UserStatus>('PENDING')
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const { data: me } = useMeQuery()
  const { data: users, isFetching } = useAdminUsersQuery(status)
  const [approve, approveState] = useApproveUserMutation()
  const [reject, rejectState] = useRejectUserMutation()

  const busy = approveState.isLoading || rejectState.isLoading
  const tab = TABS.find((t) => t.status === status) ?? TABS[0]
  const rows = users ?? []

  const allSelected = rows.length > 0 && rows.every((u) => selected.has(u.id))
  const someSelected = selected.size > 0 && !allSelected
  const selectedRows = rows.filter((u) => selected.has(u.id))
  const selfSelected = me !== undefined && selected.has(me.id)

  const canApprove = status !== 'APPROVED'
  const canReject = status !== 'REJECTED'

  // 탭을 옮기면 선택을 비운다. 남겨두면 다른 탭에서 고른 사람이 그대로 처리된다.
  const changeTab = (next: UserStatus) => {
    setStatus(next)
    setSelected(new Set())
    setNotice(null)
  }

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async () => {
    if (!pending) return
    const mutate = pending.kind === 'approve' ? approve : reject
    const verb = pending.kind === 'approve' ? '승인' : '거절'

    // 백엔드에 일괄 엔드포인트가 없어 건별로 보낸다.
    // allSettled 라야 일부가 실패해도 나머지 결과를 알 수 있다.
    const results = await Promise.allSettled(pending.targets.map((u) => mutate(u.id).unwrap()))
    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    const total = pending.targets.length

    // 단건이면 서버가 준 사유를 그대로 보여준다. '1명 중 1명 실패' 는 아무것도 알려주지 않는다.
    setNotice(
      failures.length === 0
        ? { ok: true, text: `${total}명을 ${verb}했습니다.` }
        : total === 1
          ? { ok: false, text: toErrorInfo(failures[0].reason).message }
          : { ok: false, text: `${total}명 중 ${failures.length}명을 ${verb}하지 못했습니다.` },
    )
    setSelected(new Set())
    setPending(null)
  }

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
        <div className={styles.toolbar}>
          <Checkbox
            label="전체 선택"
            checked={allSelected}
            indeterminate={someSelected}
            disabled={busy}
            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((u) => u.id)))}
          />

          {selected.size > 0 && (
            <>
              <span className={styles.selectedCount}>{selected.size}명 선택</span>
              <span className={styles.toolbarSpacer} />

              {selfSelected && canReject && (
                <span className={styles.hint}>본인은 거절할 수 없습니다</span>
              )}

              {canApprove && (
                <button
                  type="button"
                  className={styles.approve}
                  disabled={busy}
                  onClick={() => setPending({ kind: 'approve', targets: selectedRows })}
                >
                  일괄 승인
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  className={styles.reject}
                  disabled={busy || selfSelected}
                  onClick={() => setPending({ kind: 'reject', targets: selectedRows })}
                >
                  일괄 거절
                </button>
              )}
            </>
          )}
        </div>
      )}

      {notice &&
        (notice.ok ? (
          <p className={styles.notice} role="status">
            {notice.text}
          </p>
        ) : (
          <p className={styles.failure} role="alert">
            {notice.text}
          </p>
        ))}

      <div className={styles.panel} role="tabpanel" aria-busy={isFetching}>
        {rows.length === 0 && <p className={styles.empty}>{tab.empty}</p>}

        {rows.map((user) => (
          <div key={user.id} className={styles.row}>
            <Checkbox
              label={`${user.name} 선택`}
              labelHidden
              checked={selected.has(user.id)}
              disabled={busy}
              onChange={() => toggleOne(user.id)}
            />

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
              {canApprove && (
                <button
                  type="button"
                  className={styles.approve}
                  disabled={busy}
                  onClick={() => setPending({ kind: 'approve', targets: [user] })}
                >
                  승인
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  className={styles.reject}
                  // 백엔드가 CANNOT_REJECT_SELF 로 400 을 준다. 미리 막는다.
                  disabled={busy || me?.id === user.id}
                  onClick={() => setPending({ kind: 'reject', targets: [user] })}
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
