import type { ReactNode } from 'react'
import type { Bubble, Player } from '../api/types'
import type { PlayerPhase } from '../model/playerPhase'
import { avatarOption } from '../model/avatars'
import { SpeechBubble } from './SpeechBubble'
import styles from './PlayerPodium.module.scss'

const PHASE_LABEL: Partial<Record<PlayerPhase, string>> = {
  ELIMINATED: '탈락',
  SPECTATOR: '관전',
  WINNER: '승리',
}

const PHASE_CLASS: Partial<Record<PlayerPhase, string>> = {
  TURN: styles.spotlight,
  ALIVE: styles.dimmed,
  ELIMINATED: styles.out,
  SPECTATOR: styles.out,
  WINNER: styles.spotlight,
}

export interface PlayerPodiumProps {
  player: Player
  isHost: boolean
  onSelect?: () => void
  phase?: PlayerPhase
  bubble?: Bubble
  handle?: ReactNode
  dragging?: boolean
}

export const PlayerPodium = ({
  player,
  isHost,
  onSelect,
  phase,
  bubble,
  handle,
  dragging,
}: PlayerPodiumProps) => {
  const avatar = avatarOption(player.avatar)
  const phaseLabel = phase ? PHASE_LABEL[phase] : undefined

  const body = (
    <>
      <img
        className={styles.avatar}
        src={avatar.src}
        alt={avatar.label}
        width={72}
        height={72}
      />
      <span className={styles.podium}>
        <span className={styles.name}>{player.name}</span>
        {isHost && <span className={styles.host}>방장</span>}
        {!phase && !isHost && player.ready && <span className={styles.ready}>준비</span>}
        {phaseLabel && <span className={styles.phase}>{phaseLabel}</span>}
      </span>
    </>
  )

  return (
    <li
      className={`${styles.seat} ${phase ? PHASE_CLASS[phase] : ''} ${dragging ? styles.dragging : ''}`}
      aria-label={player.name}
      data-user-id={player.userId}
    >
      {handle}
      {phase && (
        <span className={styles.bubbleSlot}>{bubble && <SpeechBubble bubble={bubble} />}</span>
      )}
      {onSelect ? (
        <button
          type="button"
          className={styles.hit}
          aria-label={`${player.name} 님에게 방장 넘기기`}
          onClick={onSelect}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  )
}
