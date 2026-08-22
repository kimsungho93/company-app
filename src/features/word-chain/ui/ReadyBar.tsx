import type { Avatar } from '../api/types'
import { AvatarPicker } from './AvatarPicker'
import styles from './ReadyBar.module.scss'

export interface ReadyBarProps {
  avatar: Avatar | null
  onAvatarChange: (avatar: Avatar) => void
  isHost: boolean
  ready: boolean
  allReady: boolean
  onReadyChange: (ready: boolean) => void
  onStart: () => void
}

export const ReadyBar = ({
  avatar,
  onAvatarChange,
  isHost,
  ready,
  allReady,
  onReadyChange,
  onStart,
}: ReadyBarProps) => {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>내 아바타</span>
      <AvatarPicker value={avatar} onChange={onAvatarChange} />

      {isHost ? (
        <button type="button" className={styles.start} disabled={!allReady} onClick={onStart}>
          시작
        </button>
      ) : (
        <button
          type="button"
          className={ready ? styles.cancel : styles.start}
          aria-pressed={ready}
          onClick={() => onReadyChange(!ready)}
        >
          {ready ? '준비 취소' : '준비'}
        </button>
      )}
    </div>
  )
}
