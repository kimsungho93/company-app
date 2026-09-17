import type { GridDay } from '@/shared/lib/monthGrid'
import { LEAVE_KIND_LABEL } from '../model/types'
import type { LeaveEntry, LeaveKind } from '../model/types'
import styles from './LeaveCalendar.module.scss'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const VISIBLE_PER_DAY = 3

const KIND_CLASS: Record<LeaveKind, string> = {
  ANNUAL: styles.kindAnnual,
  HALF_DAY_AM: styles.kindHalfAm,
  HALF_DAY_PM: styles.kindHalfPm,
  OFFICIAL: styles.kindOfficial,
}

const dayLabel = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`
}

interface LeaveDayCellProps {
  day: GridDay
  dayEntries: LeaveEntry[]
  isToday: boolean
  holiday: string | null
  onSelect: (iso: string) => void
}

export const LeaveDayCell = ({
  day,
  dayEntries,
  isToday,
  holiday,
  onSelect,
}: LeaveDayCellProps) => {
  const hiddenCount = dayEntries.length - VISIBLE_PER_DAY
  return (
    <td
      className={[styles.cell, day.inMonth ? '' : styles.outside, isToday ? styles.today : '']
        .filter(Boolean)
        .join(' ')}
      aria-current={isToday ? 'date' : undefined}
    >
      <button
        type="button"
        className={styles.pick}
        aria-haspopup="dialog"
        aria-label={`${dayLabel(day.iso)} 휴가 ${dayEntries.length}명`}
        onClick={() => onSelect(day.iso)}
      />

      <span className={styles.dayHead}>
        <span
          className={[
            styles.dayNumber,
            holiday || day.weekday === 0 ? styles.sun : '',
            !holiday && day.weekday === 6 ? styles.sat : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {day.day}
        </span>
        {holiday && <span className={styles.holiday}>{holiday}</span>}
      </span>

      <ul className={styles.entries}>
        {dayEntries.slice(0, VISIBLE_PER_DAY).map((entry) => (
          <li key={entry.id} className={`${styles.entry} ${KIND_CLASS[entry.kind]}`}>
            <span className={styles.entryName}>{entry.name ?? '알 수 없음'}</span>
            <span className={styles.kind}>{LEAVE_KIND_LABEL[entry.kind]}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && <span className={styles.more}>+{hiddenCount}명</span>}
    </td>
  )
}
