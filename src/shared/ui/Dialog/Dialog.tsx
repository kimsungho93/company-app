import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface DialogProps {
  open: boolean
  labelledBy: string
  describedBy?: string
  className?: string
  dismissible?: boolean
  onDismiss: () => void
  children: ReactNode
}

export const Dialog = ({
  open, labelledBy, describedBy, className, dismissible = true, onDismiss, children,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    const trigger = document.activeElement
    if (!dialog.open) dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()

      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest('dialog:not([open])')) {
        trigger.focus()
      }
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (dismissible) onDismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onDismiss()
      }}
    >
      {children}
    </dialog>
  )
}
