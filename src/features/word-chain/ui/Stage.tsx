import { splitSeats } from '../model/seats'
import { playerPhase } from '../model/playerPhase'
import type { GameState, Player } from '../api/types'
import { PlayerPodium } from './PlayerPodium'
import styles from './Stage.module.scss'

export interface StageProps {
  players: Player[]
  hostId: number
  onSelectPlayer?: (userId: number) => void
  game?: GameState
}

export const Stage = ({ players, hostId, onSelectPlayer, game }: StageProps) => {
  const { back, front } = splitSeats(players)

  const row = (seats: Player[], className: string) => (
    <ul className={className}>
      {seats.map((player) => (
        <PlayerPodium
          key={player.userId}
          player={player}
          isHost={player.userId === hostId}
          phase={game ? playerPhase(game, player.userId) : undefined}
          bubble={game?.bubbles.find((bubble) => bubble.userId === player.userId)}
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
    <div className={styles.stage}>
      {back.length > 0 && row(back, `${styles.row} ${styles.back}`)}
      {row(front, styles.row)}
    </div>
  )
}
