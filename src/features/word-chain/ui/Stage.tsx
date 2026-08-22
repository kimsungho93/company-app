import { splitSeats } from '../model/seats'
import type { Player } from '../api/types'
import { PlayerPodium } from './PlayerPodium'
import styles from './Stage.module.scss'

export interface StageProps {
  players: Player[]
  hostId: number
  onSelectPlayer?: (userId: number) => void
}

export const Stage = ({ players, hostId, onSelectPlayer }: StageProps) => {
  const { back, front } = splitSeats(players)

  const row = (seats: Player[], className: string) => (
    <ul className={className}>
      {seats.map((player) => (
        <PlayerPodium
          key={player.userId}
          player={player}
          isHost={player.userId === hostId}
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
