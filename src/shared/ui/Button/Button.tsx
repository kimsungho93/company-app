import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
}

export const Button = ({ children, loading = false, disabled, ...rest }: ButtonProps) => {
  return (
    <button

      type="submit"
      className={styles.button}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      <span className={styles.label}>{children}</span>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  )
}
