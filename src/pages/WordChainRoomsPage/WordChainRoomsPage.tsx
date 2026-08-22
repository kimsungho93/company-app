import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CreateRoomDialog, JoinRoomDialog, RoomList } from '@/features/word-chain'
import type { RoomSummary } from '@/features/word-chain'
import styles from './WordChainRoomsPage.module.scss'

export const WordChainRoomsPage = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const notice = (state as { notice?: string } | null)?.notice ?? null
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<RoomSummary | null>(null)

  const enter = (roomId: number) => void navigate(`/games/word-chain/${roomId}`)

  return (
    <>
      <title>끝말잇기 · IBS</title>
      <header className={styles.head}>
        <h1 className={styles.title}>끝말잇기</h1>
        <button type="button" className={styles.create} onClick={() => setCreating(true)}>
          방 만들기
        </button>
      </header>

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <RoomList onJoin={(room) => (room.locked ? setJoining(room) : enter(room.id))} />

      <CreateRoomDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(room) => enter(room.id)}
      />

      <JoinRoomDialog
        room={joining}
        onClose={() => setJoining(null)}
        onJoined={(room) => enter(room.id)}
      />
    </>
  )
}
