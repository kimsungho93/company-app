import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { splitSeats } from '../model/seats'
import { playerPhase } from '../model/playerPhase'
import { applyOrder, moveTo, sameOrder } from '../model/reorder'
import type { GameState, Player } from '../api/types'
import { PlayerPodium } from './PlayerPodium'
import styles from './Stage.module.scss'

export interface StageProps {
  players: Player[]
  hostId: number
  onSelectPlayer?: (userId: number) => void
  onReorder?: (userIds: number[]) => void
  game?: GameState
}

export const Stage = ({ players, hostId, onSelectPlayer, onReorder, game }: StageProps) => {
  const stageRef = useRef<HTMLDivElement>(null)
  const [order, setOrder] = useState<number[] | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  useEffect(() => {
    setOrder(null)
    setDraggingId(null)
  }, [players])

  const seated = order ? applyOrder(players, order) : players
  const seatedIds = seated.map((player) => player.userId)
  const { back, front } = splitSeats(seated)

  const send = (next: number[]) => {
    setOrder(next)
    if (
      !sameOrder(
        next,
        players.map((player) => player.userId),
      )
    )
      onReorder?.(next)
  }

  const onPointerDown = (userId: number) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingId(userId)
    setOrder(seatedIds)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingId === null || !stageRef.current) return

    const over = [...stageRef.current.querySelectorAll<HTMLElement>('[data-user-id]')].find(
      (seat) => {
        const box = seat.getBoundingClientRect()
        return (
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        )
      },
    )

    const overId = over ? Number(over.dataset.userId) : null
    if (overId === null || overId === draggingId) return

    setOrder((current) =>
      moveTo(current ?? seatedIds, draggingId, (current ?? seatedIds).indexOf(overId)),
    )
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (draggingId === null) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    setDraggingId(null)
    send(seatedIds)
  }

  const onKeyDown = (userId: number) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (step === 0) return

    event.preventDefault()
    send(moveTo(seatedIds, userId, seatedIds.indexOf(userId) + step))
  }

  const handleFor = (player: Player) =>
    onReorder ? (
      <button
        type="button"
        className={styles.handle}
        aria-label={`${player.name} 순서 옮기기`}
        onPointerDown={onPointerDown(player.userId)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown(player.userId)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="6" cy="4" r="1.4" fill="currentColor" />
          <circle cx="10" cy="4" r="1.4" fill="currentColor" />
          <circle cx="6" cy="8" r="1.4" fill="currentColor" />
          <circle cx="10" cy="8" r="1.4" fill="currentColor" />
          <circle cx="6" cy="12" r="1.4" fill="currentColor" />
          <circle cx="10" cy="12" r="1.4" fill="currentColor" />
        </svg>
      </button>
    ) : undefined

  const row = (seats: Player[], className: string) => (
    <ul className={className}>
      {seats.map((player) => (
        <PlayerPodium
          key={player.userId}
          player={player}
          isHost={player.userId === hostId}
          phase={game ? playerPhase(game, player.userId) : undefined}
          bubble={game?.bubbles.find((bubble) => bubble.userId === player.userId)}
          handle={handleFor(player)}
          dragging={draggingId === player.userId}
          onSelect={
            onSelectPlayer && player.userId !== hostId
              ? () => onSelectPlayer(player.userId)
              : undefined
          }
        />
      ))}
    </ul>
  )

  return (
    <div className={styles.stage} ref={stageRef}>
      {back.length > 0 && row(back, `${styles.row} ${styles.back}`)}
      {row(front, styles.row)}
    </div>
  )
}
