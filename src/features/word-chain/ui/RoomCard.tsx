import type { RoomSummary } from '../api/types'
import styles from './RoomCard.module.scss'

export interface RoomCardProps {
  room: RoomSummary
  onJoin: () => void
}

export const RoomCard = ({ room, onJoin }: RoomCardProps) => {
  const full = room.playerCount >= room.capacity

  return (
    <li className={styles.card} aria-label={room.name}>
      <button type="button" className={styles.hit} disabled={full} onClick={onJoin}>
        <span className={styles.name}>{room.name}</span>
        <span className={styles.meta}>
          {room.locked && <span className={styles.badge}>비밀번호</span>}
          <span className={room.status === 'PLAYING' ? styles.playing : styles.waiting}>
            {room.status === 'PLAYING' ? '게임중' : '대기중'}
          </span>
          <span className={styles.count}>
            {room.playerCount}/{room.capacity}
          </span>
        </span>
      </button>
    </li>
  )
}
