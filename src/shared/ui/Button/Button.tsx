import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.scss'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'accent'
  size?: 'medium' | 'large'
  fullWidth?: boolean
}

export const Button = ({
  children,
  loading = false,
  disabled,
  type = 'button',
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  className,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    type={type}
    className={[
      styles.button,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    disabled={disabled || loading}
    aria-busy={loading || rest['aria-busy']}
  >
    <span className={styles.label}>{children}</span>
    {loading && <span className={styles.spinner} aria-hidden="true" />}
  </button>
)
