import type { ReactNode } from 'react'
import type { LotteryWinner } from '../api/types'
import { Button } from '@/shared/ui/Button'
import { ballColor } from './machine/ballColors'
import styles from './Lottery.module.scss'

export const WinnerTray = ({ winners, count, finished, participants = [], onCopy, copied = false, extraActions, children }: {
  winners: LotteryWinner[]
  count: number
  finished: boolean
  participants?: string[]
  onCopy?: () => void
  copied?: boolean
  extraActions?: ReactNode
  children?: ReactNode
}) => (
  <section className={`${styles.panel} ${styles.results}`} aria-labelledby="lottery-winners-title">
    <div className={styles.sectionHeading}>
      <div className={styles.resultHeading}><h2 id="lottery-winners-title">{finished ? '오늘의 당첨자' : '당첨 결과'}</h2><span className={styles.muted}>{winners.length} / {count}명</span></div>
      {winners.length > 0 && (onCopy || extraActions) && <div className={styles.resultTools}>{onCopy && <Button variant="secondary" onClick={onCopy}>{copied ? '복사됨' : '결과 복사'}</Button>}{extraActions}</div>}
    </div>
    {winners.length ? <ol className={styles.winners} aria-label="발표 순서대로 당첨자">{winners.map((winner, index) => (
      <li key={`${winner.name}-${winner.drawnAt}`} className={styles.winner}>
        <span className={styles.winnerOrder}>{index + 1}번째</span><div className={styles.winnerBall} style={{ background: ballColor(Math.max(0, participants.indexOf(winner.name))) }}><span className={styles.winnerName}>{winner.name}</span></div>
      </li>
    ))}</ol> : <div className={styles.emptySlots} aria-hidden="true">{Array.from({ length: Math.min(count, 6) }, (_, index) => <div key={index}><span>{index + 1}</span></div>)}{count > 6 && <span className={styles.moreSlots}>+{count - 6}</span>}</div>}
    <p className={styles.srOnly} role="status" aria-atomic="true">{winners.length ? `${winners.length}번째 당첨자 ${winners[winners.length - 1].name}${finished ? '. 추첨이 완료되었습니다.' : ''}` : '추첨을 기다리고 있습니다.'}</p>
    {children && <div className={styles.resultActions}>{children}</div>}
  </section>
)
