import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './ConfirmDialog.module.scss'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string

  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}

      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}

      onClick={(event) => {
        if (event.target === ref.current && !busy) onCancel()
      }}
    >
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>

        {description && (
          <div id={descriptionId} className={styles.description}>
            {description}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? `${styles.confirm} ${styles.danger}` : styles.confirm}
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
