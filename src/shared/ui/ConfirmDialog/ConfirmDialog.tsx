import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import styles from './ConfirmDialog.module.scss'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** danger 면 확인 버튼이 위험한 동작으로 보인다 */
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// 네이티브 <dialog> 를 쓴다. showModal() 하나로 포커스 트랩 · Escape ·
// ::backdrop · top layer 가 전부 따라온다. 직접 만들면 그걸 다 흉내 내야 하고,
// z-index 싸움도 시작된다.
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
      // Escape 를 누르면 dialog 가 스스로 닫힌다. 그대로 두면 open prop 과
      // 어긋나 다음 열기가 먹지 않는다. 기본 동작을 막고 상태로만 닫는다.
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onCancel()
      }}
      // 배경 클릭. dialog 자신이 target 이면 backdrop 을 누른 것이다.
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
