export type LeaveKind = '연차' | '오전반차' | '오후반차' | '공가'

export interface LeaveEntry {
  id: number
  name: string
  kind: LeaveKind
  startDate: string
  endDate: string
}

export interface CustomHoliday {
  id: number
  name: string
  startDate: string
  endDate: string
}
