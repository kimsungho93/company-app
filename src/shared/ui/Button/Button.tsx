import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
}

export const Button = ({ children, loading = false, disabled, ...rest }: ButtonProps) => {
  return (
    <button
      // 폼 안에서 기본값은 submit 이지만, 명시하지 않으면 브라우저마다 다르게 동작한 전례가 있다
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
