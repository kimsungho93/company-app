import { holidayNameOf } from '@/shared/lib/holidays'
import type { GridDay } from '@/shared/lib/monthGrid'
import type { Holiday, LeaveEntry } from '../model/types'
import { LeaveDayCell } from './LeaveDayCell'
import styles from './LeaveCalendar.module.scss'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

interface LeaveCalendarGridProps {
  grid: GridDay[][]
  heading: string
  todayIso: string
  byDate: Map<string, LeaveEntry[]>
  holidayByDate: Map<string, Holiday>
  onSelect: (iso: string) => void
}

export const LeaveCalendarGrid = ({
  grid, heading, todayIso, byDate, holidayByDate, onSelect,
}: LeaveCalendarGridProps) => (
  <table className={styles.table}>
    <caption className="visually-hidden">{heading} 휴가 현황</caption>
    <thead>
      <tr>
        {WEEKDAYS.map((label, index) => (
          <th
            key={label}
            scope="col"
            className={index === 0 ? styles.sun : index === 6 ? styles.sat : undefined}
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {grid.map((week) => (
        <tr key={week[0].iso}>
          {week.map((day) => (
            <LeaveDayCell
              key={day.iso}
              day={day}
              dayEntries={byDate.get(day.iso) ?? []}
              isToday={day.iso === todayIso}
              holiday={holidayByDate.get(day.iso)?.name ?? holidayNameOf(day.iso)}
              onSelect={onSelect}
            />
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)
