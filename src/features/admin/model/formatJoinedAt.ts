const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const pad = (n: number): string => String(n).padStart(2, '0')

export const formatJoinedAt = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const kst = new Date(parsed.getTime() + KST_OFFSET_MS)

  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` +
    ` ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}`
  )
}
