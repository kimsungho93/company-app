import type { GameOptionsValue } from '../api/types'
import styles from './GameOptions.module.scss'

const TURN_SECONDS_CHOICES = [5, 7, 10] as const

export interface GameOptionsProps extends GameOptionsValue {
  disabled: boolean
  onChange: (options: GameOptionsValue) => void
}

export const GameOptions = ({ turnSeconds, noReuse, disabled, onChange }: GameOptionsProps) => {
  return (
    <div className={styles.options}>
      <span className={styles.label}>턴 시간</span>
      <fieldset className={styles.group}>
        <legend className="visually-hidden">턴 시간</legend>
        {TURN_SECONDS_CHOICES.map((seconds) => (
          <label key={seconds} className={styles.choice}>
            <input
              type="radio"
              name="turnSeconds"
              value={seconds}
              checked={turnSeconds === seconds}
              disabled={disabled}
              aria-label={`${seconds}초`}
              onChange={() => onChange({ turnSeconds: seconds, noReuse })}
            />
            <span>{seconds}초</span>
          </label>
        ))}
      </fieldset>

      <label className={styles.reuse}>
        <input
          type="checkbox"
          checked={noReuse}
          disabled={disabled}
          onChange={(event) => onChange({ turnSeconds, noReuse: event.target.checked })}
        />
        <span>한 번 나온 단어 금지</span>
      </label>
    </div>
  )
}
