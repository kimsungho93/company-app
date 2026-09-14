import { useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import styles from './AuthCard.module.scss'

interface AuthCardProps {
  title: string
  subtitle: string
  footer: ReactNode
  children: ReactNode
}

export const AuthCard = ({ title, subtitle, footer, children }: AuthCardProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const card = ref.current
    if (!card) return
    const rect = card.getBoundingClientRect()

    card.style.setProperty('--cx', `${event.clientX - rect.left}px`)
    card.style.setProperty('--cy', `${event.clientY - rect.top}px`)
  }

  return (
    <div className={styles.card} ref={ref} onPointerMove={onPointerMove}>
      <i className={`${styles.align} ${styles.tl}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.tr}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.bl}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.br}`} aria-hidden="true" />
      <h1 className={styles.title}>
        <span className={styles.srOnly}>IBS</span>
        {title}
      </h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {children}
      {footer}
    </div>
  )
}
