import { useMemo, useState } from 'react'
import { holidayNameOf } from '@/shared/lib/holidays'
import { monthGrid, toIsoDate } from '@/shared/lib/monthGrid'
import type { Holiday, HolidayDraft, LeaveDraft, LeaveEntry } from '../model/types'
import { useLeaveCalendarData } from '../model/useLeaveCalendarData'
import { LeaveCalendarGrid } from './LeaveCalendarGrid'
import { LeaveDayDialog } from './LeaveDayDialog'
import { MonthPicker } from './MonthPicker'
import styles from './LeaveCalendar.module.scss'

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

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor])
  const window = useMemo(
    () => ({ from: grid[0][0].iso, to: grid[grid.length - 1][6].iso }),
    [grid],
  )

  const {
    byDate, holidayByDate, busy, isFetching, listError, leaveError, holidayError,
    createLeave, deleteLeave, createHoliday, deleteHoliday, resetErrors,
  } = useLeaveCalendarData(window)
  const todayIso = toIsoDate(today)

  const close = () => {
    setOpenIso(null)
    resetErrors()
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
          {listError}
        </p>
      )}

      <LeaveCalendarGrid
        grid={grid}
        heading={heading}
        todayIso={todayIso}
        byDate={byDate}
        holidayByDate={holidayByDate}
        onSelect={setOpenIso}
      />

      <LeaveDayDialog
        date={openIso}
        dayEntries={openIso ? (byDate.get(openIso) ?? []) : []}
        userName={userName}
        userId={userId}
        isAdmin={isAdmin}
        fixedHoliday={openIso ? holidayNameOf(openIso) : null}
        holiday={openIso ? (holidayByDate.get(openIso) ?? null) : null}
        busy={busy}
        leaveError={leaveError}
        holidayError={holidayError}
        onAdd={add}
        onRemove={remove}
        onSetHoliday={setHoliday}
        onClearHoliday={clearHoliday}
        onClose={close}
      />
    </section>
  )
}
