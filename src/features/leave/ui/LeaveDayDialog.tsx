import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { LeaveDraft } from '../model/conflict'
import type { CustomHoliday, LeaveEntry, LeaveKind } from '../model/types'
import { HolidayField } from './HolidayField'
import { LeaveForm } from './LeaveForm'
import styles from './LeaveDayDialog.module.scss'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const KIND_CLASS: Record<LeaveKind, string> = {
  연차: styles.kindAnnual,
  오전반차: styles.kindHalfAm,
  오후반차: styles.kindHalfPm,
  공가: styles.kindOfficial,
}

const dayTitle = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}요일`
}

const shortDate = (iso: string): string => {
  const [, month, day] = iso.split('-')
  return `${Number(month)}/${Number(day)}`
}

const spanOf = (entry: LeaveEntry): string | null =>
  entry.startDate === entry.endDate
    ? null
    : `${shortDate(entry.startDate)}–${shortDate(entry.endDate)}`

export interface LeaveDayDialogProps {
  date: string | null
  dayEntries: LeaveEntry[]
  allEntries: LeaveEntry[]
  userName?: string
  isAdmin?: boolean
  fixedHoliday: string | null
  customHoliday: CustomHoliday | null
  onAdd: (draft: LeaveDraft) => void
  onRemove: (entry: LeaveEntry) => void
  onSetHoliday: (name: string, endDate: string) => void
  onClearHoliday: () => void
  onClose: () => void
}

export const LeaveDayDialog = ({
  date,
  dayEntries,
  allEntries,
  userName,
  isAdmin = false,
  fixedHoliday,
  customHoliday,
  onAdd,
  onRemove,
  onSetHoliday,
  onClearHoliday,
  onClose,
}: LeaveDayDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [removing, setRemoving] = useState<LeaveEntry | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (date && !el.open) el.showModal()
    else if (!date && el.open) el.close()
  }, [date])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      {date && (
        <div className={styles.body}>
          <header className={styles.head}>
            <h2 id={titleId} className={styles.title}>
              {dayTitle(date)}
            </h2>
            {(customHoliday?.name ?? fixedHoliday) && (
              <span className={styles.holiday}>{customHoliday?.name ?? fixedHoliday}</span>
            )}
            <span className={styles.count}>{dayEntries.length}명</span>
            <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
              ×
            </button>
          </header>

          {dayEntries.length === 0 ? (
            <p className={styles.empty}>쉬는 사람이 없습니다.</p>
          ) : (
            <ul className={styles.list}>
              {dayEntries.map((entry) => {
                const span = spanOf(entry)

                return (
                  <li key={entry.id} className={styles.row}>
                    <span className={`${styles.dot} ${KIND_CLASS[entry.kind]}`} aria-hidden="true" />
                    <span className={styles.name}>{entry.name}</span>
                    <span className={styles.meta}>
                      {entry.kind}
                      {span && ` · ${span}`}
                    </span>
                    {entry.name === userName && (
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label={`${entry.name} ${entry.kind} 삭제`}
                        onClick={() => setRemoving(entry)}
                      >
                        삭제
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <LeaveForm
            date={date}
            name={userName}
            entries={allEntries}
            onAdd={(draft) => {
              onAdd(draft)
              onClose()
            }}
          />

          {isAdmin && (
            <div className={styles.admin}>
              <HolidayField
                date={date}
                fixedHoliday={fixedHoliday}
                customHoliday={customHoliday}
                onSet={onSetHoliday}
                onClear={onClearHoliday}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="휴가를 삭제하시겠습니까?"
        description={removing && `${dayTitle(removing.startDate)} ${removing.kind}가 사라집니다.`}
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => {
          if (removing) onRemove(removing)
          setRemoving(null)
          onClose()
        }}
        onCancel={() => setRemoving(null)}
      />
    </dialog>
  )
}
