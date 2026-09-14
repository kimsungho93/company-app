import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion'
import { useLotteryRoom } from '../model/useLotteryRoom'
import { usePresentedWinners } from '../model/usePresentedWinners'
import { useResultImageDownload } from '../model/useResultImageDownload'
import { LotterySettingsPanel } from './LotterySettingsPanel'
import { WinnerTray } from './WinnerTray'
import styles from './Lottery.module.scss'

const LotteryMachine = lazy(() => import('./LotteryMachine').then((module) => ({ default: module.LotteryMachine })))
const NO_WINNERS: [] = []

export const LotteryRoom = ({ roomId, myUserId }: { roomId: string; myUserId?: number }) => {
  const game = useLotteryRoom(roomId)
  const { room } = game
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState<'link' | 'winners' | null>(null)
  const [copyError, setCopyError] = useState<'link' | 'winners' | null>(null)
  const stage = useRef<HTMLElement>(null)
  const settings = useRef<HTMLElement>(null)
  const previousStatus = useRef(room?.status)
  const reducedMotion = usePrefersReducedMotion()
  const winners = usePresentedWinners(room?.winners ?? NO_WINNERS, game.serverOffsetMs)
  const finished = room?.status === 'FINISHED' && winners.length === room.winnerCount
  const resultImage = useResultImageDownload(`${roomId}:${room?.drawId}:${room?.status === 'READY'}`)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 3000)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (room && room.hostId === myUserId && previousStatus.current && previousStatus.current !== room.status) {
      const target = room.status === 'DRAWING' ? stage.current : room.status === 'READY' ? settings.current : null
      target?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
      target?.focus({ preventScroll: true })
    }
    previousStatus.current = room?.status
  }, [room, myUserId, reducedMotion])

  useEffect(() => { setCopied(null); setCopyError(null) }, [room?.drawId, roomId])

  const copy = async (kind: 'link' | 'winners') => {
    const text = kind === 'link' ? window.location.href : `${room?.title ?? '추첨 결과'}\n${winners.map((winner, index) => `${index + 1}. ${winner.name}`).join('\n')}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setCopyError(null)
    } catch {
      setCopyError(kind)
    }
  }

  if (!room) return <div className={styles.empty}>
    <h1>사람 뽑기</h1>
    {game.connecting ? <p role="status">추첨방에 들어가는 중…</p> : <><p role="alert">{game.error ?? '추첨방에 연결하지 못했어요.'}</p><Button onClick={game.reconnect}>다시 연결</Button></>}
    <p><Link to="/games/lottery">추첨방 목록으로</Link></p>
  </div>

  const isHost = myUserId === room.hostId
  const connected = !game.connecting && !game.disconnected
  const preparing = room.status === 'READY' && isHost
  return (
    <div className={styles.page}>
      <div className={styles.roomTop}><Link to="/games/lottery" className={styles.back}>← 추첨방 목록</Link><div className={styles.topActions}><Button variant="secondary" onClick={() => void copy('link')}>{copied === 'link' ? '링크 복사됨' : '초대 링크 복사'}</Button><Button variant="secondary" disabled={game.busy} onClick={() => { void game.leave().then((left) => { if (left) void navigate('/games/lottery') }) }}>방 나가기</Button></div></div>
      <header className={styles.heading}><div><h1>{room.title}</h1><p>진행자 {room.hostName} · 추첨 대상 {room.participants.length}명</p></div><span className={`${styles.badge} ${game.disconnected ? styles.offlineBadge : ''}`}>{connected ? '실시간 연결됨' : game.disconnected ? '연결 끊김' : '연결 중'}</span></header>
      {copied && <span className={styles.srOnly} role="status">{copied === 'link' ? '초대 링크를 복사했습니다.' : '발표된 당첨 결과를 복사했습니다.'}</span>}
      {copyError && <div className={styles.notice}><p role="alert">{copyError === 'link' ? '링크를 직접 선택해 복사해 주세요.' : '복사하지 못했습니다. 아래 당첨자 이름을 선택해 복사해 주세요.'}</p>{copyError === 'link' && <input aria-label="초대 링크" readOnly value={window.location.href} onFocus={(event) => event.currentTarget.select()} />}</div>}
      {(game.error || game.disconnected) && <div className={styles.errorBanner}><p role="alert">{game.error ?? '연결이 끊겼어요. 다시 연결하면 최신 결과를 이어서 볼 수 있어요.'}</p>{game.disconnected && <Button variant="secondary" onClick={game.reconnect}>다시 연결</Button>}</div>}
      <div className={`${styles.gameLayout} ${preparing ? styles.preparing : ''}`}>
        <div className={styles.mainColumn}>
          <section ref={stage} tabIndex={-1} className={`${styles.panel} ${styles.stage}`} aria-labelledby="lottery-stage-title">
            <div className={styles.stageHeading}><span className={styles.eyebrow}>{room.status === 'READY' ? '추첨 준비' : finished ? '추첨 완료' : '추첨 중'}</span><h2 id="lottery-stage-title">{room.status === 'READY' ? `${room.participants.length}명 중 ${room.winnerCount}명을 뽑아요` : finished ? '당첨을 축하합니다!' : '공을 뽑고 있어요'}</h2>{room.status !== 'READY' && <div className={styles.drawProgress}><progress max={room.winnerCount} value={winners.length} aria-label="당첨자 발표 진행" /><span>{winners.length} / {room.winnerCount}명</span></div>}{room.status === 'READY' && !isHost && <p className={styles.muted}>진행자가 시작하면 함께 볼 수 있어요.</p>}</div>
            <Suspense fallback={<div className={styles.machineLoading} role="status">추첨기를 준비하는 중…</div>}><LotteryMachine participants={room.participants} winners={room.winners} status={room.status} drawId={room.drawId} nextDrawAt={room.nextDrawAt} serverOffsetMs={game.serverOffsetMs} /></Suspense>
          </section>
          <WinnerTray winners={winners} count={room.winnerCount} finished={!!finished} participants={room.participants} onCopy={() => void copy('winners')} copied={copied === 'winners'}
            extraActions={<>
              <Button variant="secondary" loading={resultImage.status === 'creating'} onClick={() => void resultImage.saveImage({ title: room.title, participants: room.participants, winners, winnerCount: room.winnerCount, finished: !!finished })}>{resultImage.status === 'creating' ? '이미지 만드는 중…' : '결과 이미지 저장'}</Button>
              {resultImage.status === 'requested' && <span className={styles.srOnly} role="status">결과 이미지 다운로드를 시작했습니다.</span>}
              {resultImage.status === 'failed' && <p className={styles.resultExportError} role="alert">이미지를 저장하지 못했어요. 다시 시도해 주세요.</p>}
            </>}>
            {finished && isHost && <Button variant="secondary" disabled={!connected || game.busy} onClick={() => setResetting(true)}>새 추첨 준비</Button>}
          </WinnerTray>
        </div>
        <aside ref={settings} tabIndex={-1} className={styles.sidebar} aria-label="추첨 설정과 참여자">
          <LotterySettingsPanel key={`${room.id}:${room.drawId}:${JSON.stringify(room.participants)}:${room.winnerCount}`} room={room} isHost={isHost} busy={game.busy} connected={connected} onSave={game.saveSettings} onStart={game.start} />
          <details className={`${styles.panel} ${styles.members}`}><summary><span>함께 보는 사람</span><span className={styles.muted}>{room.members.length}명</span></summary><ul>{room.members.map((member) => <li key={member.userId}><span>{member.name}</span>{member.userId === room.hostId && <span className={styles.badge}>진행자</span>}</li>)}</ul></details>
        </aside>
      </div>
      <ConfirmDialog open={resetting} title="새 추첨을 준비할까요?" description="이번 당첨 결과를 지우고 같은 명단으로 다시 준비합니다. 모든 참여자 화면이 함께 바뀝니다." confirmLabel="새 추첨 준비" busy={game.busy} onCancel={() => setResetting(false)} onConfirm={() => { void game.reset().then((reset) => { if (reset) setResetting(false) }) }} />
    </div>
  )
}
