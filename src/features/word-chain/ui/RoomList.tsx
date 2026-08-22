import { toErrorInfo } from '@/shared/api'
import { useRoomsQuery } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import { RoomCard } from './RoomCard'
import styles from './RoomList.module.scss'

export interface RoomListProps {
  onJoin: (room: RoomSummary) => void
}

export const RoomList = ({ onJoin }: RoomListProps) => {
  const { data: rooms = [], isLoading, error } = useRoomsQuery()

  if (isLoading) {
    return <p className={styles.empty}>불러오는 중…</p>
  }

  if (error && rooms.length === 0) {
    return (
      <p className={styles.error} role="alert">
        {toErrorInfo(error).message}
      </p>
    )
  }

  if (rooms.length === 0) {
    return <p className={styles.empty}>아직 만들어진 방이 없습니다.</p>
  }

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {toErrorInfo(error).message}
        </p>
      )}
      <ul className={styles.list}>
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} onJoin={() => onJoin(room)} />
        ))}
      </ul>
    </>
  )
}
