import { useMemo, useRef, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { holidayNameOf } from '@/shared/lib/holidays'
import { monthGrid, toIsoDate } from '@/shared/lib/monthGrid'
import {
  useCreateHolidayMutation,
  useCreateLeaveMutation,
  useDeleteHolidayMutation,
  useDeleteLeaveMutation,
  useHolidaysQuery,
  useLeavesQuery,
} from '../api/leaveApi'
import { eachDate } from '../model/dateRange'
import { LEAVE_KIND_LABEL } from '../model/types'
import type { Holiday, HolidayDraft, LeaveDraft, LeaveEntry, LeaveKind } from '../model/types'
import { leavesByDate } from '../model/leaves'
import { LeaveDayDialog } from './LeaveDayDialog'
import { MonthPicker } from './MonthPicker'
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

export interface LeaveCalendarProps {
  userName?: string
  userId?: number
  isAdmin?: boolean
}

export const LeaveCalendar = ({ userName, userId, isAdmin = false }: LeaveCalendarProps) => {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  }))
  const [openIso, setOpenIso] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const window = useMemo(
    () => ({ from: grid[0][0].iso, to: grid[grid.length - 1][6].iso }),
    [grid],
  )

  const { data: leaves = [], isFetching, error: listError } = useLeavesQuery(window)
  const { data: holidays = [] } = useHolidaysQuery(window)

  const [createLeave, createLeaveState] = useCreateLeaveMutation()
  const [deleteLeave, deleteLeaveState] = useDeleteLeaveMutation()
  const [createHoliday, createHolidayState] = useCreateHolidayMutation()
  const [deleteHoliday, deleteHolidayState] = useDeleteHolidayMutation()

  const byDate = useMemo(() => leavesByDate(leaves), [leaves])
  const holidayByDate = useMemo(() => {
    const map = new Map<string, Holiday>()
    for (const holiday of holidays) {
      for (const iso of eachDate(holiday.startDate, holiday.endDate)) map.set(iso, holiday)
    }
    return map
  }, [holidays])

  const todayIso = toIsoDate(today)
  const holidayOf = (iso: string): string | null =>
    holidayByDate.get(iso)?.name ?? holidayNameOf(iso)

  const busy =
    createLeaveState.isLoading ||
    deleteLeaveState.isLoading ||
    createHolidayState.isLoading ||
    deleteHolidayState.isLoading

  const errorOf = (error: unknown) => (error ? toErrorInfo(error).message : null)

  const close = () => {
    setOpenIso(null)
    createLeaveState.reset()
    deleteLeaveState.reset()
    createHolidayState.reset()
    deleteHolidayState.reset()
    triggerRef.current?.focus()
    triggerRef.current = null
  }

  const add = async (draft: LeaveDraft) => {
    if (!('error' in (await createLeave(draft)))) close()
  }

  const remove = async (entry: LeaveEntry) => {
    if (!('error' in (await deleteLeave(entry.id)))) close()
  }

  const setHoliday = (draft: HolidayDraft) => {
    void createHoliday(draft)
  }

  const clearHoliday = (holiday: Holiday) => {
    void deleteHoliday(holiday.id)
  }

  const shift = (delta: number) =>
    setCursor((prev) => {
      const next = new Date(prev.year, prev.month - 1 + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })

  const heading = `${cursor.year}년 ${cursor.month}월`

  return (
    <section className={styles.calendar} aria-label="휴가 캘린더" aria-busy={isFetching}>
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

      {listError && (
        <p className={styles.listError} role="alert">
          {toErrorInfo(listError).message}
        </p>
      )}

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
                          <span className={styles.entryName}>{entry.name ?? '알 수 없음'}</span>
                          <span className={styles.kind}>{LEAVE_KIND_LABEL[entry.kind]}</span>
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
        userName={userName}
        userId={userId}
        isAdmin={isAdmin}
        fixedHoliday={openIso ? holidayNameOf(openIso) : null}
        holiday={openIso ? (holidayByDate.get(openIso) ?? null) : null}
        busy={busy}
        leaveError={errorOf(createLeaveState.error ?? deleteLeaveState.error)}
        holidayError={errorOf(createHolidayState.error ?? deleteHolidayState.error)}
        onAdd={add}
        onRemove={remove}
        onSetHoliday={setHoliday}
        onClearHoliday={clearHoliday}
        onClose={close}
      />
    </section>
  )
}
