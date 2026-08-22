import { useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { Avatar, Player, RoomState } from '../api/types'
import { ReadyBar } from './ReadyBar'
import { Stage } from './Stage'
import styles from './RoomView.module.scss'

export interface RoomViewProps {
  room: RoomState
  myUserId: number
  onAvatarChange: (avatar: Avatar) => void
  onReadyChange: (ready: boolean) => void
  onTransfer: (userId: number) => void
  onStart: () => void
  onLeave: () => void
}

export const RoomView = ({
  room,
  myUserId,
  onAvatarChange,
  onReadyChange,
  onTransfer,
  onStart,
  onLeave,
}: RoomViewProps) => {
  const [handingTo, setHandingTo] = useState<Player | null>(null)

  const me = room.players.find((player) => player.userId === myUserId)
  const isHost = room.hostId === myUserId
  const allReady =
    room.players.length >= 2 &&
    room.players.every((player) => player.userId === room.hostId || player.ready)

  return (
    <>
      <header className={styles.head}>
        <h1 className={styles.title}>{room.name}</h1>
        <span className={styles.count}>
          {room.players.length}/{room.capacity}
        </span>
        <button type="button" className={styles.leave} onClick={onLeave}>
          나가기
        </button>
      </header>

      <Stage
        players={room.players}
        hostId={room.hostId}
        onSelectPlayer={
          isHost
            ? (userId) =>
                setHandingTo(room.players.find((player) => player.userId === userId) ?? null)
            : undefined
        }
      />

      <ReadyBar
        avatar={me?.avatar ?? null}
        onAvatarChange={onAvatarChange}
        isHost={isHost}
        ready={me?.ready ?? false}
        allReady={allReady}
        onReadyChange={onReadyChange}
        onStart={onStart}
      />

      <ConfirmDialog
        open={handingTo !== null}
        title={handingTo ? `${handingTo.name} 님에게 방장을 넘기시겠습니까?` : ''}
        description="넘기면 되돌릴 수 없습니다."
        confirmLabel="넘기기"
        onConfirm={() => {
          if (handingTo) onTransfer(handingTo.userId)
          setHandingTo(null)
        }}
        onCancel={() => setHandingTo(null)}
      />
    </>
  )
}
