import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toErrorInfo } from '@/shared/api'
import {
  CreateRoomDialog,
  JoinRoomDialog,
  RoomList,
  useJoinRoomMutation,
} from '@/features/word-chain'
import type { RoomSummary } from '@/features/word-chain'
import styles from './WordChainRoomsPage.module.scss'

export const WordChainRoomsPage = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const notice = (state as { notice?: string } | null)?.notice ?? null
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState<RoomSummary | null>(null)
  const [joinRoom, { isLoading, error }] = useJoinRoomMutation()

  const enter = (roomId: number) => void navigate(`/games/word-chain/${roomId}`)

  const join = async (room: RoomSummary) => {
    if (isLoading) return

    const result = await joinRoom({ id: room.id })
    if ('error' in result) return

    enter(room.id)
  }

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

      {error && (
        <p className={styles.error} role="alert">
          {toErrorInfo(error).message}
        </p>
      )}

      <RoomList onJoin={(room) => (room.locked ? setJoining(room) : void join(room))} />

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
