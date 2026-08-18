import { useMemo, useRef, useState } from 'react'
import { holidayNameOf } from '@/shared/lib/holidays'
import { monthGrid, toIsoDate } from '@/shared/lib/monthGrid'
import type { LeaveDraft } from '../model/conflict'
import { leavesByDate } from '../model/leaves'
import { eachDate } from '../model/dateRange'
import type { CustomHoliday, LeaveEntry, LeaveKind } from '../model/types'
import { LeaveDayDialog } from './LeaveDayDialog'
import { MonthPicker } from './MonthPicker'
import styles from './LeaveCalendar.module.scss'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const VISIBLE_PER_DAY = 3

const KIND_CLASS: Record<LeaveKind, string> = {
  연차: styles.kindAnnual,
  오전반차: styles.kindHalfAm,
  오후반차: styles.kindHalfPm,
  공가: styles.kindOfficial,
}

const dayLabel = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`
}

export interface LeaveCalendarProps {
  userName?: string
  initialEntries?: LeaveEntry[]
  isAdmin?: boolean
}

export const LeaveCalendar = ({
  userName,
  initialEntries = [],
  isAdmin = false,
}: LeaveCalendarProps) => {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }))
  const [entries, setEntries] = useState<LeaveEntry[]>(initialEntries)
  const [openIso, setOpenIso] = useState<string | null>(null)
  const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([])
  const nextHolidayId = useRef(1)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const nextId = useRef(Math.max(0, ...initialEntries.map((entry) => entry.id)) + 1)

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const byDate = useMemo(() => leavesByDate(entries), [entries])
  const todayIso = toIsoDate(today)

  const close = () => {
    setOpenIso(null)
    triggerRef.current?.focus()
    triggerRef.current = null
  }

  const add = (draft: LeaveDraft) => {
    setEntries((prev) => [...prev, { id: nextId.current++, ...draft }])
  }

  const remove = (entry: LeaveEntry) => {
    setEntries((prev) => prev.filter((item) => item.id !== entry.id))
  }

  const customByDate = useMemo(() => {
    const map = new Map<string, CustomHoliday>()
    for (const holiday of customHolidays) {
      for (const iso of eachDate(holiday.startDate, holiday.endDate)) map.set(iso, holiday)
    }
    return map
  }, [customHolidays])

  const holidayOf = (iso: string): string | null =>
    customByDate.get(iso)?.name ?? holidayNameOf(iso)

  const shift = (delta: number) =>
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month - 1 + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })

  const heading = `${cursor.year}년 ${cursor.month}월`

  return (
    <section className={styles.calendar} aria-label="휴가 캘린더">
      <div className={styles.rings} aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={styles.ring} />
        ))}
      </div>

      <header className={styles.bar}>
        <button type="button" className={styles.nav} aria-label="이전 달" onClick={() => shift(-1)}>
          ‹
        </button>
        <MonthPicker
          year={cursor.year}
          month={cursor.month}
          onSelect={(year, month) => setCursor({ year, month })}
        />
        <button type="button" className={styles.nav} aria-label="다음 달" onClick={() => shift(1)}>
          ›
        </button>
        <button
          type="button"
          className={styles.todayButton}
          onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() + 1 })}
        >
          오늘
        </button>
      </header>

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
              {week.map((day) => {
                const dayEntries = byDate.get(day.iso) ?? []
                const hiddenCount = dayEntries.length - VISIBLE_PER_DAY
                const isToday = day.iso === todayIso
                const holiday = holidayOf(day.iso)

                return (
                  <td
                    key={day.iso}
                    className={[
                      styles.cell,
                      day.inMonth ? '' : styles.outside,
                      isToday ? styles.today : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-current={isToday ? 'date' : undefined}
                  >
                    <button
                      type="button"
                      className={styles.pick}
                      aria-haspopup="dialog"
                      aria-label={`${dayLabel(day.iso)} 휴가 ${dayEntries.length}명`}
                      onClick={(event) => {
                        triggerRef.current = event.currentTarget
                        setOpenIso(day.iso)
                      }}
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
                          <span className={styles.entryName}>{entry.name}</span>
                          <span className={styles.kind}>{entry.kind}</span>
                        </li>
                      ))}
                    </ul>

                    {hiddenCount > 0 && <span className={styles.more}>+{hiddenCount}명</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <LeaveDayDialog
        date={openIso}
        dayEntries={openIso ? (byDate.get(openIso) ?? []) : []}
        allEntries={entries}
        userName={userName}
        isAdmin={isAdmin}
        fixedHoliday={openIso ? holidayNameOf(openIso) : null}
        customHoliday={openIso ? (customByDate.get(openIso) ?? null) : null}
        onAdd={add}
        onRemove={remove}
        onSetHoliday={(name, endDate) => {
          if (!openIso) return
          setCustomHolidays((prev) => [
            ...prev,
            { id: nextHolidayId.current++, name, startDate: openIso, endDate },
          ])
        }}
        onClearHoliday={() => {
          const target = openIso && customByDate.get(openIso)
          if (!target) return
          setCustomHolidays((prev) => prev.filter((item) => item.id !== target.id))
        }}
        onClose={close}
      />
    </section>
  )
}
