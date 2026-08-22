export const LEAVE_KINDS = ['ANNUAL', 'HALF_DAY_AM', 'HALF_DAY_PM', 'OFFICIAL'] as const

export type LeaveKind = (typeof LEAVE_KINDS)[number]

export const LEAVE_KIND_LABEL: Record<LeaveKind, string> = {
  ANNUAL: '연차',
  HALF_DAY_AM: '오전반차',
  HALF_DAY_PM: '오후반차',
  OFFICIAL: '공가',
}

export const isHalfDay = (kind: LeaveKind): boolean =>
  kind === 'HALF_DAY_AM' || kind === 'HALF_DAY_PM'

export interface LeaveEntry {
  id: number
  userId: number
  name: string | null
  kind: LeaveKind
  startDate: string
  endDate: string
}

export interface Holiday {
  id: number
  name: string
  startDate: string
  endDate: string
}

export interface LeaveDraft {
  kind: LeaveKind
  startDate: string
  endDate: string
}

export interface HolidayDraft {
  name: string
  startDate: string
  endDate: string
}

export interface DateWindow {
  from: string
  to: string
}
