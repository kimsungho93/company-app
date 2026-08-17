import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import styles from './Checkbox.module.scss'

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string
}

export const Checkbox = ({ label, ...rest }: CheckboxProps) => {
  const id = useId()

  return (
    <div className={styles.row}>
      {/*
        네이티브 input 을 지우고 div 로 흉내 내면 키보드 조작·스크린리더 상태 전달을
        전부 직접 구현해야 한다. 시각적으로만 감추고 실제 동작은 input 에 맡긴다.
      */}
      <input id={id} type="checkbox" className={styles.input} {...rest} />
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
        </span>
        {label}
      </label>
    </div>
  )
}
