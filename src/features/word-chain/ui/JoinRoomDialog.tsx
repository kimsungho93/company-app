import { useEffect, useId, useRef, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { TextField } from '@/shared/ui/TextField'
import { useJoinRoomMutation } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import styles from './JoinRoomDialog.module.scss'

export interface JoinRoomDialogProps {
  room: RoomSummary | null
  onClose: () => void
  onJoined: (room: RoomSummary) => void
}

export const JoinRoomDialog = ({ room, onClose, onJoined }: JoinRoomDialogProps) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const prevRoomId = useRef(room?.id)
  const [password, setPassword] = useState('')
  const [joinRoom, { isLoading, error, reset }] = useJoinRoomMutation()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (room && !el.open) el.showModal()
    else if (!room && el.open) el.close()
  }, [room])

  useEffect(() => {
    if (prevRoomId.current === room?.id) return
    prevRoomId.current = room?.id
    setPassword('')
    reset()
  }, [room?.id, reset])

  const close = () => {
    if (isLoading) return
    onClose()
  }

  const submit = async () => {
    if (!room || isLoading) return

    const result = await joinRoom({ id: room.id, password })
    if ('error' in result) return

    onJoined(result.data)
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === ref.current) close()
      }}
    >
      {room && (
        <form
          className={styles.body}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <h2 id={titleId} className={styles.title}>{room.name}</h2>
          <p className={styles.sub}>
            {room.playerCount}/{room.capacity} · 방장 {room.hostName}
          </p>

          <TextField
            label="비밀번호"
            type="password"
            value={password}
            autoComplete="off"
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <p className={styles.error} role="alert">
              {toErrorInfo(error).message}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} disabled={isLoading} onClick={close}>
              취소
            </button>
            <button
              type="submit"
              className={styles.submit}
              disabled={isLoading}
              aria-busy={isLoading}
            >
              들어가기
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
