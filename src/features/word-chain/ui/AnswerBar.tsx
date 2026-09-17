import { useEffect, useRef, useState } from 'react'
import type { CompositionEvent, KeyboardEvent } from 'react'
import type { PlayerPhase } from '../model/playerPhase'
import { TurnBar } from './TurnBar'
import styles from './AnswerBar.module.scss'

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const JONGSEONG_RIEUL = 8

const startHint = (word: string): string => {
  const syllable = word.slice(-1)
  const code = syllable.charCodeAt(0)
  const jongseong = code >= HANGUL_BASE && code <= HANGUL_LAST ? (code - HANGUL_BASE) % 28 : 0
  const particle = jongseong === 0 || jongseong === JONGSEONG_RIEUL ? '로' : '으로'

  return `${syllable}${particle} 시작하는 세 글자`
}

export interface AnswerBarProps {
  phase: PlayerPhase
  currentWord: string
  turnPlayerName: string
  triesLeft: number
  awaitingJudgement: boolean
  turnEndsAt: number
  serverNow: number
  onSubmit: (word: string) => void
}

export const AnswerBar = ({
  phase,
  currentWord,
  turnPlayerName,
  triesLeft,
  awaitingJudgement,
  turnEndsAt,
  serverNow,
  onSubmit,
}: AnswerBarProps) => {
  const [word, setWord] = useState('')
  const pendingSubmit = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const myTurn = phase === 'TURN'
  const canType = myTurn && !awaitingJudgement

  useEffect(() => {
    pendingSubmit.current = false
  }, [myTurn])

  useEffect(() => {
    if (canType) inputRef.current?.focus()
  }, [canType])

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
    phase === 'SPECTATOR'
      ? '다음 판부터 참가합니다'
      : awaitingJudgement && myTurn
        ? '확인 중…'
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
          disabled={!canType}
          autoComplete="off"
          aria-label="답"
          placeholder={startHint(currentWord)}
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
          disabled={!canType}
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
