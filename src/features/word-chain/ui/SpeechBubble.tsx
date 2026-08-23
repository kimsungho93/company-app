import type { Bubble, BubbleState, FailReason } from '../api/types'
import styles from './SpeechBubble.module.scss'

const STATE_LABEL: Record<BubbleState, string> = {
  PENDING: '확인 중',
  PASS: '통과',
  FAIL: '오답',
}

const FAIL_LABEL: Record<FailReason, string> = {
  NOT_THREE_LETTERS: '세 글자가 아닙니다',
  NOT_CHAINED: '앞 단어와 안 이어집니다',
  ALREADY_USED: '이미 나온 단어입니다',
  NOT_IN_DICTIONARY: '사전에 없는 명사입니다',
}

export interface SpeechBubbleProps {
  bubble: Bubble
}

export const SpeechBubble = ({ bubble }: SpeechBubbleProps) => {
  const note =
    bubble.state === 'FAIL' && bubble.reason
      ? FAIL_LABEL[bubble.reason]
      : bubble.state === 'PASS' && bubble.verified === false
        ? '사전 확인 못 함'
        : null

  return (
    <span className={`${styles.bubble} ${styles[bubble.state.toLowerCase()]}`}>
      <span className={styles.word}>{bubble.word}</span>
      <span className="visually-hidden">{STATE_LABEL[bubble.state]}</span>
      {bubble.state === 'PASS' && <span aria-hidden="true">✓</span>}
      {bubble.state === 'FAIL' && <span aria-hidden="true">✗</span>}
      {note && <span className={styles.note}>{note}</span>}
    </span>
  )
}
