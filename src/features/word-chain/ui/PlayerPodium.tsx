import type { Player } from '../api/types'
import { avatarOption } from '../model/avatars'
import styles from './PlayerPodium.module.scss'

export interface PlayerPodiumProps {
  player: Player
  isHost: boolean
  onSelect?: () => void
}

export const PlayerPodium = ({ player, isHost, onSelect }: PlayerPodiumProps) => {
  const avatar = avatarOption(player.avatar)

  const body = (
    <>
      <img
        className={styles.avatar}
        src={avatar.src}
        alt={avatar.label}
        width={72}
        height={72}
      />
      <span className={styles.podium}>
        <span className={styles.name}>{player.name}</span>
        {isHost && <span className={styles.host}>방장</span>}
        {!isHost && player.ready && <span className={styles.ready}>준비</span>}
      </span>
    </>
  )

  return (
    <li className={styles.seat} aria-label={player.name}>
      {onSelect ? (
        <button type="button" className={styles.hit} onClick={onSelect}>
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  )
}
