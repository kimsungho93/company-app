import type { LeaveEntry, LeaveKind } from './types'

export interface LeaveDraft {
  name: string
  kind: LeaveKind
  startDate: string
  endDate: string
}

export const findConflict = (entries: LeaveEntry[], draft: LeaveDraft): LeaveEntry | null =>
  entries.find(
    (entry) =>
      entry.name === draft.name &&
      entry.startDate <= draft.endDate &&
      draft.startDate <= entry.endDate,
  ) ?? null
