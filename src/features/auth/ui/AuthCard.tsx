import type { ReactNode } from 'react'
import styles from './AuthCard.module.scss'

interface AuthCardProps {
  title: string
  subtitle: string
  footer: ReactNode
  children: ReactNode
}

export const AuthCard = ({ title, subtitle, footer, children }: AuthCardProps) => {
  return (
    <div className={styles.card}>
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
