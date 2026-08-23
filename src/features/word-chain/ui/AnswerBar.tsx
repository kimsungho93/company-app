import { useEffect, useRef, useState } from 'react'
import type { CompositionEvent, KeyboardEvent } from 'react'
import type { PlayerPhase } from '../model/playerPhase'
import { TurnBar } from './TurnBar'
import styles from './AnswerBar.module.scss'

export interface AnswerBarProps {
  phase: PlayerPhase
  currentWord: string
  turnPlayerName: string
  triesLeft: number
  turnEndsAt: number
  serverNow: number
  onSubmit: (word: string) => void
}

export const AnswerBar = ({
  phase,
  currentWord,
  turnPlayerName,
  triesLeft,
  turnEndsAt,
  serverNow,
  onSubmit,
}: AnswerBarProps) => {
  const [word, setWord] = useState('')
  const pendingSubmit = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const myTurn = phase === 'TURN'

  useEffect(() => {
    pendingSubmit.current = false
    if (myTurn) inputRef.current?.focus()
  }, [myTurn])

  const submit = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setWord('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    if (event.nativeEvent.isComposing) {
      pendingSubmit.current = true
      return
    }
    event.preventDefault()
    submit(word)
  }

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    if (!pendingSubmit.current) return
    pendingSubmit.current = false
    submit(event.currentTarget.value)
  }

  const status =
    phase === 'ELIMINATED'
      ? '탈락했습니다'
      : phase === 'SPECTATOR'
        ? '다음 판부터 참가합니다'
        : myTurn
          ? `${triesLeft}번 남음`
          : `${turnPlayerName} 님 차례`

  return (
    <div className={styles.bar}>
      <TurnBar key={turnEndsAt} turnEndsAt={turnEndsAt} serverNow={serverNow} />

      <div className={styles.row}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={word}
          disabled={!myTurn}
          autoComplete="off"
          aria-label="답"
          placeholder={`${currentWord.slice(-1)}로 시작하는 세 글자`}
          onChange={(event) => setWord(event.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            pendingSubmit.current = false
          }}
          onCompositionEnd={handleCompositionEnd}
        />
        <button
          type="button"
          className={styles.submit}
          disabled={!myTurn}
          onClick={() => submit(word)}
        >
          내기
        </button>
        <span className={styles.status} role="status">
          {status}
        </span>
      </div>
    </div>
  )
}
