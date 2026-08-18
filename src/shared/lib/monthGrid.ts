export interface GridDay {
  iso: string
  day: number
  inMonth: boolean
  weekday: number
}

const pad = (n: number): string => String(n).padStart(2, '0')

export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const WEEKS = 6

export const monthGrid = (year: number, month: number): GridDay[][] => {
  const first = new Date(year, month - 1, 1)
  const cursor = new Date(year, month - 1, 1 - first.getDay())

  return Array.from({ length: WEEKS }, () =>
    Array.from({ length: 7 }, () => {
      const day: GridDay = {
        iso: toIsoDate(cursor),
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month - 1,
        weekday: cursor.getDay(),
      }
      cursor.setDate(cursor.getDate() + 1)
      return day
    }),
  )
}
