import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMeQuery } from '@/features/auth'
import { RoomView, useRoomSocket } from '@/features/word-chain'
import styles from './WordChainRoomPage.module.scss'

export const WordChainRoomPage = () => {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { data: me } = useMeQuery()
  const { room, error, disconnected, send } = useRoomSocket(Number(roomId))

  const leave = () => {
    send.leave()
    void navigate('/games/word-chain')
  }

  useEffect(() => {
    if (!disconnected) return
    void navigate('/games/word-chain', {
      replace: true,
      state: { notice: '연결이 끊어져 방에서 나왔습니다.' },
    })
  }, [disconnected, navigate])

  return (
    <>
      <title>끝말잇기 · IBS</title>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {room && me ? (
        <RoomView
          room={room}
          myUserId={me.id}
          onAvatarChange={send.avatar}
          onReadyChange={send.ready}
          onTransfer={send.transfer}
          onStart={send.start}
          onLeave={leave}
        />
      ) : (
        <p className={styles.loading}>방에 들어가는 중…</p>
      )}
    </>
  )
}
