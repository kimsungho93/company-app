import { useEffect, useRef, useState } from 'react'
import styles from './MonthPicker.module.scss'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export interface MonthPickerProps {
  year: number
  month: number
  onSelect: (year: number, month: number) => void
}

export const MonthPicker = ({ year, month, onSelect }: MonthPickerProps) => {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div className={styles.picker} ref={rootRef}>
      <h2 className={styles.heading} aria-live="polite">
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          onClick={() => {
            setViewYear(year)
            setOpen((prev) => !prev)
          }}
        >
          {year}년 {month}월
        </button>
      </h2>

      {open && (
        <div className={styles.panel}>
          <div className={styles.yearBar}>
            <button
              type="button"
              className={styles.yearNav}
              aria-label="이전 연도"
              onClick={() => setViewYear((prev) => prev - 1)}
            >
              ‹
            </button>
            <span className={styles.year} aria-live="polite">
              {viewYear}년
            </span>
            <button
              type="button"
              className={styles.yearNav}
              aria-label="다음 연도"
              onClick={() => setViewYear((prev) => prev + 1)}
            >
              ›
            </button>
          </div>

          <div className={styles.months}>
            {MONTHS.map((value) => {
              const current = viewYear === year && value === month

              return (
                <button
                  key={value}
                  type="button"
                  className={current ? `${styles.month} ${styles.monthCurrent}` : styles.month}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => {
                    onSelect(viewYear, value)
                    close()
                  }}
                >
                  {value}월
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
