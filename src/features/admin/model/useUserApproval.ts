import { useState } from 'react'
import type { UserStatus } from '@/features/auth'
import {
  useAdminUsersQuery, useApproveUserMutation, useRejectUserMutation,
} from '../api/adminUsersApi'
import type { AdminUser } from '../api/types'
import { summarizeResults } from './summarizeResults'
import type { ActionNotice } from './summarizeResults'

type ActionKind = 'approve' | 'reject'

export interface PendingAction {
  kind: ActionKind

  targets: AdminUser[]
}

export const useUserApproval = (currentUserId?: number) => {
  const [status, setStatus] = useState<UserStatus>('PENDING')
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [notice, setNotice] = useState<ActionNotice | null>(null)

  const { currentData: users, isFetching, error, refetch } = useAdminUsersQuery(status)
  const [approve] = useApproveUserMutation()
  const [reject] = useRejectUserMutation()

  const [busy, setBusy] = useState(false)
  const rows = users ?? []

  const allSelected = rows.length > 0 && rows.every((u) => selected.has(u.id))
  const someSelected = rows.some((u) => selected.has(u.id)) && !allSelected
  const selectedRows = rows.filter((u) => selected.has(u.id))
  const selfSelected = currentUserId !== undefined && selectedRows.some((u) => u.id === currentUserId)

  const canApprove = status !== 'APPROVED'
  const canReject = status !== 'REJECTED'

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
    if (!pending || busy) return
    setBusy(true)
    const mutate = pending.kind === 'approve' ? approve : reject
    const verb = pending.kind === 'approve' ? '승인' : '거절'

    const results = await Promise.allSettled(pending.targets.map((u) => mutate(u.id).unwrap()))

    setNotice(summarizeResults(pending.targets, results, verb))
    setSelected(new Set())
    setPending(null)
    setBusy(false)
  }

  return {
    status, selected, pending, notice, rows, isFetching, error, refetch, busy,
    loading: isFetching && users === undefined,
    allSelected, someSelected, selectedRows, selfSelected, canApprove, canReject,
    changeTab, toggleOne, run, setPending,
    toggleAll: () => setSelected(allSelected ? new Set() : new Set(rows.map((u) => u.id))),
  }
}
