import { Component, useCallback, useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { MachineScene } from './machine/MachineScene'
import { ballColor } from './machine/ballColors'
import { EXIT_DURATION_MS } from './machine/motion'
import { SETTLE_DURATION_MS } from '../model/drawTiming'
import styles from './LotteryMachine.module.scss'

export type LotteryMachineProps = {
  participants: string[]
  winners: { name: string; drawnAt: string }[]
  status: 'READY' | 'DRAWING' | 'FINISHED'
  drawId: number
  nextDrawAt: string | null
  serverOffsetMs: number
}

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

const MachineFallback = ({ participants, winners, status }: LotteryMachineProps) => {
  const drawn = new Set(winners.map((winner) => winner.name))
  return (
    <div className={styles.fallback}>
      <div className={styles.fallbackGlobe}>
        <div className={styles.fallbackBalls}>
          {participants
            .filter((name) => !drawn.has(name))
            .slice(0, 50)
            .map((name) => (
              <span
                key={name}
                className={styles.fallbackBall}
                style={{ '--ball-color': ballColor(participants.indexOf(name)) } as CSSProperties}
              >
                <span>{name}</span>
              </span>
            ))}
        </div>
      </div>
      <div className={styles.fallbackBase}>
        <span>{status === 'DRAWING' ? '추첨 중' : 'LUCKY DRAW'}</span>
      </div>
      <span className={styles.fallbackNote}>간편 보기 · 추첨 결과는 실시간으로 표시됩니다</span>
    </div>
  )
}

class MachineBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export const LotteryMachine = (props: LotteryMachineProps) => {
  const reducedMotion = useReducedMotion()
  const [contextLost, setContextLost] = useState(false)
  const [now, setNow] = useState(Date.now)
  const onContextLost = useCallback(() => setContextLost(true), [])
  const fallback = <MachineFallback {...props} />
  const remaining = props.participants.length - props.winners.length
  const lastDrawnAt = props.winners.at(-1)?.drawnAt
  const serverNow = Math.max(now, Date.now()) + props.serverOffsetMs
  const exitEndsAt =
    props.status !== 'READY' && lastDrawnAt ? Date.parse(lastDrawnAt) + EXIT_DURATION_MS : 0
  const presenting = props.status === 'DRAWING' || serverNow < exitEndsAt
  const settling = props.status === 'FINISHED' && serverNow < exitEndsAt + SETTLE_DURATION_MS
  const animationEndsAt =
    serverNow < exitEndsAt ? exitEndsAt : settling ? exitEndsAt + SETTLE_DURATION_MS : 0

  useEffect(() => {
    if (!animationEndsAt) return
    const remainingMs = animationEndsAt - Date.now() - props.serverOffsetMs
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, remainingMs))
    return () => window.clearTimeout(timeout)
  }, [animationEndsAt, props.serverOffsetMs])

  return (
    <div
      className={styles.machine}
      role="img"
      aria-label={`이름이 적힌 공 ${remaining}개가 남은 추첨기. ${presenting ? '추첨 중입니다.' : props.status === 'FINISHED' ? '추첨이 완료되었습니다.' : '추첨을 기다리고 있습니다.'}`}
    >
      <div className={styles.ground} aria-hidden="true" />
      <MachineBoundary fallback={fallback}>
        {contextLost ? (
          fallback
        ) : (
          <Canvas
            camera={{ position: [1.3, 0.8, 7.8], fov: 37, near: 0.1, far: 30 }}
            dpr={[1, 1.5]}
            shadows="percentage"
            gl={{ alpha: true, antialias: true, powerPreference: 'default' }}
            fallback={fallback}
            aria-hidden="true"
            frameloop={!reducedMotion && (presenting || settling) ? 'always' : 'demand'}
          >
            <MachineScene
              {...props}
              mixing={presenting}
              reducedMotion={reducedMotion}
              onContextLost={onContextLost}
            />
          </Canvas>
        )}
      </MachineBoundary>
      <div className={styles.caption} aria-hidden="true">
        <span className={`${styles.indicator} ${presenting ? styles.active : ''}`} />
        {presenting
          ? '행운의 주인공을 뽑고 있어요'
          : props.status === 'FINISHED'
            ? '행운의 주인공이 모두 정해졌어요'
            : `${props.participants.length}명의 행운을 담았어요`}
      </div>
    </div>
  )
}
