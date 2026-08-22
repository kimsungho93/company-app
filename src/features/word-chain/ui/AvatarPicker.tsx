import type { Avatar } from '../api/types'
import { AVATAR_OPTIONS } from '../model/avatars'
import styles from './AvatarPicker.module.scss'

export interface AvatarPickerProps {
  value: Avatar | null
  onChange: (avatar: Avatar) => void
}

export const AvatarPicker = ({ value, onChange }: AvatarPickerProps) => {
  return (
    <fieldset className={styles.picker}>
      <legend className="visually-hidden">내 아바타</legend>
      {AVATAR_OPTIONS.map((option) => (
        <label key={option.value} className={styles.option}>
          <input
            type="radio"
            name="avatar"
            value={option.value}
            checked={value === option.value}
            aria-label={option.label}
            onChange={() => onChange(option.value)}
          />
          <img src={option.src} alt="" width={40} height={40} />
        </label>
      ))}
    </fieldset>
  )
}
