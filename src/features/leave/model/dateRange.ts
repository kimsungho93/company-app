import { toIsoDate } from '@/shared/lib/monthGrid'

export const eachDate = (startDate: string, endDate: string): string[] => {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)

  while (cursor <= last) {
    dates.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}
