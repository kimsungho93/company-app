const FIXED: { md: string; name: string }[] = [
  { md: '01-01', name: '신정' },
  { md: '03-01', name: '삼일절' },
  { md: '05-05', name: '어린이날' },
  { md: '06-06', name: '현충일' },
  { md: '08-15', name: '광복절' },
  { md: '10-03', name: '개천절' },
  { md: '10-09', name: '한글날' },
  { md: '12-25', name: '성탄절' },
]

export const holidayNameOf = (iso: string): string | null =>
  FIXED.find((item) => iso.endsWith(item.md))?.name ?? null
