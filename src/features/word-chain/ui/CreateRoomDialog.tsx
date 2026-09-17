import { useId, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import { toErrorInfo } from '@/shared/api'
import { TextField } from '@/shared/ui/TextField'
import { useCreateRoomMutation } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import { validateRoomName } from '../model/validateRoomName'
import styles from './CreateRoomDialog.module.scss'

export interface CreateRoomDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (room: RoomSummary) => void
}

export const CreateRoomDialog = ({ open, onClose, onCreated }: CreateRoomDialogProps) => {
  const titleId = useId()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [createRoom, { isLoading, error, reset }] = useCreateRoomMutation()

  const close = () => {
    setName('')
    setPassword('')
    setNameError(null)
    reset()
    onClose()
  }

  const submit = async () => {
    if (isLoading) return

    const invalid = validateRoomName(name)
    setNameError(invalid)
    if (invalid) return

    const trimmedPassword = password.trim()
    const result = await createRoom({
      name: name.trim(),
      ...(trimmedPassword ? { password: trimmedPassword } : {}),
    })
    if ('error' in result) return

    onCreated(result.data)
    close()
  }

  return (
    <Dialog
      open={open}
      labelledBy={titleId}
      className={styles.dialog}
      dismissible={!isLoading}
      onDismiss={close}
    >
      <form
        className={styles.body}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2 id={titleId} className={styles.title}>
          방 만들기
        </h2>

        <TextField
          label="방 이름"
          value={name}
          maxLength={40}
          autoComplete="off"
          error={nameError}
          help="29자까지 쓸 수 있습니다."
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />

        <TextField
          label="비밀번호"
          type="password"
          value={password}
          autoComplete="off"
          help="비워두면 누구나 들어올 수 있습니다."
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p className={styles.error} role="alert">
            {toErrorInfo(error).message}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" disabled={isLoading} onClick={close}>
            취소
          </Button>
          <Button type="submit" loading={isLoading}>
            만들기
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
