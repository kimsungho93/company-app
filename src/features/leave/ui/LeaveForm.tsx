import { useEffect, useId, useState } from 'react'
import { findConflict } from '../model/conflict'
import type { LeaveDraft } from '../model/conflict'
import type { LeaveEntry, LeaveKind } from '../model/types'
import styles from './LeaveForm.module.scss'

const KINDS: LeaveKind[] = ['연차', '오전반차', '오후반차', '공가']

const dayText = (iso: string): string => {
  const [, month, day] = iso.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

export interface LeaveFormProps {
  date: string
  name: string | undefined
  entries: LeaveEntry[]
  onAdd: (draft: LeaveDraft) => void
}

export const LeaveForm = ({ date, name, entries, onAdd }: LeaveFormProps) => {
  const [kind, setKind] = useState<LeaveKind>('연차')
  const [endDate, setEndDate] = useState(date)
  const [error, setError] = useState<string | null>(null)
  const endId = useId()
  const groupId = useId()

  useEffect(() => {
    setEndDate(date)
    setError(null)
  }, [date])

  const ranged = kind !== '오전반차' && kind !== '오후반차'
  const draft: LeaveDraft = {
    name: name ?? '',
    kind,
    startDate: date,
    endDate: ranged ? endDate : date,
  }

  const submit = () => {
    if (!name) return

    if (draft.endDate < draft.startDate) {
      setError('종료일이 시작일보다 빠릅니다.')
      return
    }

    const conflict = findConflict(entries, draft)
    if (conflict) {
      setError(`${dayText(conflict.startDate)}부터 ${conflict.kind}가 이미 있습니다.`)
      return
    }

    onAdd(draft)
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
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
        {KINDS.map((option) => (
          <label key={option} className={styles.kindOption}>
            <input
              type="radio"
              name="leave-kind"
              value={option}
              checked={kind === option}
              onChange={() => {
                setKind(option)
                setError(null)
              }}
            />
            <span>{option}</span>
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
            onChange={(event) => {
              setEndDate(event.target.value)
              setError(null)
            }}
          />
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <button type="submit" className={styles.submit} disabled={!name}>
        등록
      </button>
    </form>
  )
}
