import { useEffect, useId, useState } from 'react'
import type { Holiday, HolidayDraft } from '../model/types'
import styles from './HolidayField.module.scss'

const shortDate = (iso: string): string => {
  const [, month, day] = iso.split('-')
  return `${Number(month)}/${Number(day)}`
}

export interface HolidayFieldProps {
  date: string
  fixedHoliday: string | null
  holiday: Holiday | null
  busy: boolean
  error: string | null
  onSet: (draft: HolidayDraft) => void
  onClear: (holiday: Holiday) => void
}

export const HolidayField = ({
  date,
  fixedHoliday,
  holiday,
  busy,
  error,
  onSet,
  onClear,
}: HolidayFieldProps) => {
  const [name, setName] = useState('')
  const [endDate, setEndDate] = useState(date)
  const nameId = useId()
  const endId = useId()

  useEffect(() => {
    setName('')
    setEndDate(date)
  }, [date, holiday?.id])

  if (fixedHoliday) {
    return (
      <p className={styles.fixed}>
        <span className={styles.tag}>법정공휴일</span>
        {fixedHoliday}
      </p>
    )
  }

  if (holiday) {
    const ranged = holiday.startDate !== holiday.endDate

    return (
      <p className={styles.set}>
        <span className={styles.tag}>{ranged ? '연휴' : '공휴일'}</span>
        {holiday.name}
        {ranged && (
          <span className={styles.span}>
            {shortDate(holiday.startDate)}–{shortDate(holiday.endDate)}
          </span>
        )}
        <button
          type="button"
          className={styles.clear}
          disabled={busy}
          aria-busy={busy}
          onClick={() => onClear(holiday)}
        >
          해제
        </button>
      </p>
    )
  }

  const trimmed = name.trim()

  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <label htmlFor={nameId} className="visually-hidden">
          공휴일 이름
        </label>
        <input
          id={nameId}
          className={styles.input}
          value={name}
          placeholder="설날"
          maxLength={12}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (trimmed && !busy) onSet({ name: trimmed, startDate: date, endDate })
          }}
        />
        <button
          type="button"
          className={styles.submit}
          disabled={!trimmed || busy}
          aria-busy={busy}
          onClick={() => onSet({ name: trimmed, startDate: date, endDate })}
        >
          지정
        </button>
      </div>

      <div className={styles.row}>
        <label htmlFor={endId} className={styles.endLabel}>
          공휴일 종료일
        </label>
        <input
          id={endId}
          type="date"
          className={styles.input}
          value={endDate}
          min={date}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
