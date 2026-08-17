import { useId, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './TextField.module.scss'

/**
 * 아이콘은 "현재 상태"가 아니라 "누르면 일어날 일"을 뜻한다.
 * 가려진 상태 → 뜬 눈(보기), 보이는 상태 → 가려진 눈(숨기기).
 * 눈 아이콘이 헷갈린다는 지적은 대개 이 방향이 반대일 때 나온다.
 */
const EyeIcon = () => {
  return (
    <svg viewBox="0 0 20 20" className={styles.icon} aria-hidden="true">
      <path d="M1.8 10S5 4.6 10 4.6 18.2 10 18.2 10 15 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  )
}

const EyeOffIcon = () => {
  return (
    <svg viewBox="0 0 20 20" className={styles.icon} aria-hidden="true">
      <path d="M8.4 5.2A8.2 8.2 0 0 1 10 5.1c5 0 8.2 4.9 8.2 4.9a15.4 15.4 0 0 1-2.6 3.2" />
      <path d="M5 6.5A15.6 15.6 0 0 0 1.8 10S5 14.9 10 14.9a8 8 0 0 0 3-.6" />
      <path d="M8.4 8.5a2.3 2.3 0 0 0 3.2 3.2" />
      <path d="M3 3l14 14" />
    </svg>
  )
}

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string
  type?: 'text' | 'email' | 'password'
  error?: string | null
  /**
   * 입력 규칙 안내. 오류가 없을 때만 보인다.
   * 오류 문구가 이미 규칙을 담고 있어서 둘을 함께 띄우면 같은 말이 두 번 나온다.
   */
  help?: string
  aside?: ReactNode
}

export const TextField = ({
  label,
  type = 'text',
  error = null,
  help,
  aside,
  ...rest
}: TextFieldProps) => {
  const id = useId()
  const errorId = `${id}-error`
  const helpId = `${id}-help`
  const [revealed, setRevealed] = useState(false)

  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        {/* placeholder 로 라벨을 대신하지 않는다. 입력하면 사라져서 맥락을 잃는다 */}
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>

      <div className={`${styles.box} ${error ? styles.invalid : ''}`}>
        <input
          id={id}
          className={styles.input}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : help ? helpId : undefined}
          {...rest}
        />
        {isPassword && (
          // tabIndex 로 빼지 않는다. 빼면 키보드만 쓰는 사용자는
          // 비밀번호를 확인할 방법이 아예 없어진다.
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? '비밀번호 숨기기' : '비밀번호 표시'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : (
        help && (
          <p className={styles.help} id={helpId}>
            {help}
          </p>
        )
      )}
    </div>
  )
}
