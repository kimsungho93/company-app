import { useState } from 'react'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import type { Avatar, GameOptionsValue, Player, RoomState } from '../api/types'
import { playerPhase } from '../model/playerPhase'
import { AnswerBar } from './AnswerBar'
import { GameOptions } from './GameOptions'
import { ReadyBar } from './ReadyBar'
import { Stage } from './Stage'
import { WinnerBanner } from './WinnerBanner'
import styles from './RoomView.module.scss'

export interface RoomViewProps {
  room: RoomState
  myUserId: number
  onAvatarChange: (avatar: Avatar) => void
  onReadyChange: (ready: boolean) => void
  onTransfer: (userId: number) => void
  onStart: () => void
  onLeave: () => void
  onAnswer: (word: string) => void
  onOptionsChange: (options: GameOptionsValue) => void
}

export const RoomView = ({
  room,
  myUserId,
  onAvatarChange,
  onReadyChange,
  onTransfer,
  onStart,
  onLeave,
  onAnswer,
  onOptionsChange,
}: RoomViewProps) => {
  const [handingTo, setHandingTo] = useState<Player | null>(null)

  const me = room.players.find((player) => player.userId === myUserId)
  const isHost = room.hostId === myUserId
  const game = room.game
  const playing = room.status === 'PLAYING' && game !== null
  const finished = room.status === 'WAITING' && game !== null && game.winnerId !== null
  const allReady =
    room.players.length >= 2 &&
    room.players.every((player) => player.userId === room.hostId || player.ready)

  const winner = finished
    ? room.players.find((player) => player.userId === game.winnerId)
    : undefined
  const turnPlayer = playing
    ? room.players.find((player) => player.userId === game.turnUserId)
    : undefined

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

      {game && playing && (
        <p className={styles.currentWord} data-testid="current-word" role="status">
          {game.currentWord}
        </p>
      )}

      <Stage
        players={room.players}
        hostId={room.hostId}
        game={playing ? game : undefined}
        onSelectPlayer={
          isHost && !playing
            ? (userId) =>
                setHandingTo(room.players.find((player) => player.userId === userId) ?? null)
            : undefined
        }
      />

      {game && playing && room.noReuse && (
        <p className={styles.usedWords} data-testid="used-words">
          {game.usedWords.join(' · ')}
        </p>
      )}

      {finished && winner && <WinnerBanner name={winner.name} />}

      {game && playing && game.turnEndsAt !== null && (
        <AnswerBar
          phase={playerPhase(game, myUserId)}
          currentWord={game.currentWord}
          turnPlayerName={turnPlayer?.name ?? ''}
          triesLeft={game.triesLeft}
          awaitingJudgement={
            game.bubbles.find((bubble) => bubble.userId === myUserId)?.state === 'PENDING'
          }
          turnEndsAt={game.turnEndsAt}
          serverNow={room.serverNow}
          onSubmit={onAnswer}
        />
      )}

      {!playing && (
        <>
          <GameOptions
            turnSeconds={room.turnSeconds}
            noReuse={room.noReuse}
            disabled={!isHost}
            onChange={onOptionsChange}
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
        </>
      )}

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
