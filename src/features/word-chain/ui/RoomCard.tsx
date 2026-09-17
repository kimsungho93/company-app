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
        <span className={styles.top}>
          <span className={styles.name}>{room.name}</span>
          {room.locked && (
            <>
              <svg
                className={styles.lock}
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <rect x="3" y="7" width="10" height="7" rx="1.8" fill="currentColor" />
              </svg>
              <span className="visually-hidden">비밀번호 필요</span>
            </>
          )}
        </span>

        <span className={styles.host}>방장 {room.hostName}</span>

        <span className={styles.meta}>
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
