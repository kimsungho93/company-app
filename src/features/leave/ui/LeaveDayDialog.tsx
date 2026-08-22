import { useEffect, useId, useRef, useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { LEAVE_KIND_LABEL } from '../model/types'
import type { Holiday, HolidayDraft, LeaveDraft, LeaveEntry, LeaveKind } from '../model/types'
import { HolidayField } from './HolidayField'
import { LeaveForm } from './LeaveForm'
import styles from './LeaveDayDialog.module.scss'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const KIND_CLASS: Record<LeaveKind, string> = {
  ANNUAL: styles.kindAnnual,
  HALF_DAY_AM: styles.kindHalfAm,
  HALF_DAY_PM: styles.kindHalfPm,
  OFFICIAL: styles.kindOfficial,
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
  userName?: string
  userId?: number
  isAdmin?: boolean
  fixedHoliday: string | null
  holiday: Holiday | null
  busy: boolean
  leaveError: string | null
  holidayError: string | null
  onAdd: (draft: LeaveDraft) => void
  onRemove: (entry: LeaveEntry) => void
  onSetHoliday: (draft: HolidayDraft) => void
  onClearHoliday: (holiday: Holiday) => void
  onClose: () => void
}

export const LeaveDayDialog = ({
  date,
  dayEntries,
  userName,
  userId,
  isAdmin = false,
  fixedHoliday,
  holiday,
  busy,
  leaveError,
  holidayError,
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
            {(holiday?.name ?? fixedHoliday) && (
              <span className={styles.holiday}>{holiday?.name ?? fixedHoliday}</span>
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
                const label = LEAVE_KIND_LABEL[entry.kind]

                return (
                  <li key={entry.id} className={styles.row}>
                    <span className={`${styles.dot} ${KIND_CLASS[entry.kind]}`} aria-hidden="true" />
                    <span className={styles.name}>{entry.name ?? '알 수 없음'}</span>
                    <span className={styles.meta}>
                      {label}
                      {span && ` · ${span}`}
                    </span>
                    {entry.userId === userId && (
                      <button
                        type="button"
                        className={styles.remove}
                        disabled={busy}
                        aria-label={`${entry.name ?? '내'} ${label} 삭제`}
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
            busy={busy}
            error={leaveError}
            onAdd={onAdd}
          />

          {isAdmin && (
            <div className={styles.admin}>
              <HolidayField
                date={date}
                fixedHoliday={fixedHoliday}
                holiday={holiday}
                busy={busy}
                error={holidayError}
                onSet={onSetHoliday}
                onClear={onClearHoliday}
              />
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        busy={busy}
        title="휴가를 삭제하시겠습니까?"
        description={
          removing &&
          `${dayTitle(removing.startDate)} ${LEAVE_KIND_LABEL[removing.kind]}가 사라집니다.`
        }
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => {
          if (removing) onRemove(removing)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </dialog>
  )
}
