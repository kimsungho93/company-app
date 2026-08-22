import { useEffect, useId, useState } from 'react'
import { LEAVE_KINDS, LEAVE_KIND_LABEL, isHalfDay } from '../model/types'
import type { LeaveDraft, LeaveKind } from '../model/types'
import styles from './LeaveForm.module.scss'

const dayText = (iso: string): string => {
  const [, month, day] = iso.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

export interface LeaveFormProps {
  date: string
  name: string | undefined
  busy: boolean
  error: string | null
  onAdd: (draft: LeaveDraft) => void
}

export const LeaveForm = ({ date, name, busy, error, onAdd }: LeaveFormProps) => {
  const [kind, setKind] = useState<LeaveKind>('ANNUAL')
  const [endDate, setEndDate] = useState(date)
  const endId = useId()
  const groupId = useId()

  useEffect(() => {
    setEndDate(date)
  }, [date])

  const ranged = !isHalfDay(kind)

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        if (!name || busy) return
        onAdd({ kind, startDate: date, endDate: ranged ? endDate : date })
      }}
    >
      <p className={styles.who}>
        <span className={styles.whoName}>{name ?? '—'}</span>
        <span className={styles.whoDate}>{dayText(date)}</span>
      </p>

      <fieldset className={styles.kinds}>
        <legend id={groupId} className="visually-hidden">
          휴가 종류
        </legend>
        {LEAVE_KINDS.map((option) => (
          <label key={option} className={styles.kindOption}>
            <input
              type="radio"
              name="leave-kind"
              value={option}
              checked={kind === option}
              onChange={() => setKind(option)}
            />
            <span>{LEAVE_KIND_LABEL[option]}</span>
          </label>
        ))}
      </fieldset>

      {ranged && (
        <div className={styles.range}>
          <label htmlFor={endId} className={styles.rangeLabel}>
            종료일
          </label>
          <input
            id={endId}
            type="date"
            className={styles.rangeInput}
            value={endDate}
            min={date}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={!name || busy} aria-busy={busy}>
        {busy ? '등록 중…' : '등록'}
      </button>
    </form>
  )
}
