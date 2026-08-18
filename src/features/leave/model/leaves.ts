import { eachDate } from './dateRange'
import type { LeaveEntry } from './types'

export const leavesByDate = (entries: LeaveEntry[]): Map<string, LeaveEntry[]> => {
  const map = new Map<string, LeaveEntry[]>()

  for (const entry of entries) {
    for (const iso of eachDate(entry.startDate, entry.endDate)) {
      map.set(iso, [...(map.get(iso) ?? []), entry])
    }
  }

  return map
}
