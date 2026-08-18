import { useId, useState } from 'react'
import type { CustomHoliday } from '../model/types'
import styles from './HolidayField.module.scss'

const shortDate = (iso: string): string => {
  const [, month, day] = iso.split('-')
  return `${Number(month)}/${Number(day)}`
}

export interface HolidayFieldProps {
  date: string
  fixedHoliday: string | null
  customHoliday: CustomHoliday | null
  onSet: (name: string, endDate: string) => void
  onClear: () => void
}

export const HolidayField = ({
  date,
  fixedHoliday,
  customHoliday,
  onSet,
  onClear,
}: HolidayFieldProps) => {
  const [name, setName] = useState('')
  const [endDate, setEndDate] = useState(date)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const endId = useId()

  if (fixedHoliday) {
    return (
      <p className={styles.fixed}>
        <span className={styles.tag}>법정공휴일</span>
        {fixedHoliday}
      </p>
    )
  }

  if (customHoliday) {
    const ranged = customHoliday.startDate !== customHoliday.endDate

    return (
      <p className={styles.set}>
        <span className={styles.tag}>{ranged ? '연휴' : '공휴일'}</span>
        {customHoliday.name}
        {ranged && (
          <span className={styles.span}>
            {shortDate(customHoliday.startDate)}–{shortDate(customHoliday.endDate)}
          </span>
        )}
        <button type="button" className={styles.clear} onClick={onClear}>
          해제
        </button>
      </p>
    )
  }

  const trimmed = name.trim()

  const submit = () => {
    if (!trimmed) return

    if (endDate < date) {
      setError('종료일이 시작일보다 빠릅니다.')
      return
    }

    onSet(trimmed, endDate)
  }

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
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
        <button type="button" className={styles.submit} disabled={!trimmed} onClick={submit}>
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
          onChange={(event) => {
            setEndDate(event.target.value)
            setError(null)
          }}
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
