import { useState } from 'react'
import styles from './TurnBar.module.scss'

export interface TurnBarProps {
  turnEndsAt: number
  serverNow: number
}

export const TurnBar = ({ turnEndsAt, serverNow }: TurnBarProps) => {
  const [durationMs] = useState(() => Math.max(0, turnEndsAt - serverNow))

  return (
    <div className={styles.track}>
      <div
        className={styles.fill}
        data-testid="turn-bar"
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  )
}
