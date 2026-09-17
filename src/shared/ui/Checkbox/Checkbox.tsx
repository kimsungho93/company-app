import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './Checkbox.module.scss'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string

  labelHidden?: boolean

  indeterminate?: boolean
}

export const Checkbox = ({
  label,
  labelHidden = false,
  indeterminate = false,
  ...rest
}: CheckboxProps) => {
  const id = useId()

  return (
    <div className={styles.row}>
      <input
        id={id}
        type="checkbox"
        className={styles.input}

        ref={(el) => {
          if (el) el.indeterminate = indeterminate
        }}
        {...rest}
      />
      <label htmlFor={id} className={styles.label}>
        <span className={styles.box} aria-hidden="true">
          <svg viewBox="0 0 12 12" className={styles.check}>
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.dash} />
        </span>
        <span className={labelHidden ? 'visually-hidden' : undefined}>{label}</span>
      </label>
    </div>
  )
}
