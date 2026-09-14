import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toErrorInfo } from '@/shared/api'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { useCreateLotteryRoomMutation, useLotteryRoomsQuery } from '../api/lotteryApi'
import { DEFAULT_PARTICIPANTS, validateLotteryTitle } from '../model/participants'
import { ballColor } from './machine/ballColors'
import styles from './Lottery.module.scss'

const STATUS_LABELS = { READY: '준비 중', DRAWING: '추첨 중', FINISHED: '발표 완료' }
const FILTERS = [{ value: 'all', label: '전체' }, { value: 'active', label: '준비·진행 중' }, { value: 'finished', label: '완료' }] as const

export const LotteryLobby = () => {
  const navigate = useNavigate()
  const [title, setTitle] = useState('오늘의 추첨')
  const [validation, setValidation] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all')
  const { data: rooms, isLoading, isFetching, isError, refetch } = useLotteryRoomsQuery(undefined, {
    pollingInterval: 5000,
    skipPollingIfUnfocused: true,
  })
  const [create, { isLoading: creating, error }] = useCreateLotteryRoomMutation()
  const counts = {
    all: rooms?.length ?? 0,
    active: rooms?.filter((room) => room.status !== 'FINISHED').length ?? 0,
    finished: rooms?.filter((room) => room.status === 'FINISHED').length ?? 0,
  }
  const visibleRooms = rooms?.filter((room) => filter === 'all' || (filter === 'finished' ? room.status === 'FINISHED' : room.status !== 'FINISHED'))
    .sort((a, b) => Number(a.status === 'FINISHED') - Number(b.status === 'FINISHED'))

  const submit = async () => {
    if (creating) return
    const invalid = validateLotteryTitle(title)
    setValidation(invalid)
    if (invalid) return
    const result = await create({ title: title.trim(), participants: [...DEFAULT_PARTICIPANTS], winnerCount: 1 })
    if (result.data) void navigate(`/games/lottery/${result.data.id}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div><h1>사람 뽑기</h1><p>추첨방을 만들거나 동료의 추첨에 참여하세요.</p></div>
        <div className={styles.sampleBalls} aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} style={{ background: ballColor(index) }} />)}</div>
      </header>
      <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="lottery-create-title">
        <h2 id="lottery-create-title">새 추첨방</h2>
        <form onSubmit={(event) => { event.preventDefault(); void submit() }} className={styles.createForm}>
          <TextField label="방 이름" value={title} maxLength={60} disabled={creating} error={validation} onChange={(event) => { setTitle(event.target.value); setValidation(null) }} />
          <Button type="submit" loading={creating}>방 만들기</Button>
        </form>
        {error && <p className={styles.error} role="alert">{toErrorInfo(error).message}</p>}
      </section>
      <section aria-labelledby="lottery-rooms-title">
        <div className={styles.sectionHeading}><h2 id="lottery-rooms-title">추첨방 목록</h2><Button variant="secondary" loading={isFetching && !isLoading} onClick={() => void refetch()} aria-label="추첨방 목록 새로고침">새로고침</Button></div>
        <div className={styles.filters} role="group" aria-label="추첨방 필터">{FILTERS.map((item) => <button key={item.value} type="button" aria-label={`${item.label} ${counts[item.value]}`} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span>{counts[item.value]}</span></button>)}</div>
        {isLoading ? <p className={styles.empty} role="status">추첨방을 불러오는 중…</p> : isError ? <div className={styles.empty}><p role="alert">추첨방을 불러오지 못했습니다.</p><Button variant="secondary" onClick={() => void refetch()}>다시 불러오기</Button></div> : visibleRooms?.length ? (
          <div className={styles.roomGrid}>{visibleRooms.map((room) => (
            <Link key={room.id} to={`/games/lottery/${room.id}`} className={styles.roomCard}>
              <span className={`${styles.badge} ${room.status === 'DRAWING' ? styles.liveBadge : room.status === 'FINISHED' ? styles.finishedBadge : ''}`}>{STATUS_LABELS[room.status]}</span>
              <h3>{room.title}</h3><p>{room.hostName}님의 추첨</p>
              <div className={styles.roomMeta}><span>추첨 대상 {room.participantCount}명 · 당첨 {room.winnerCount}명</span><strong>{room.status === 'FINISHED' ? '결과 보기' : '참여하기'} →</strong></div>
            </Link>
          ))}</div>
        ) : <div className={styles.empty}><p>{filter === 'finished' ? '완료된 추첨이 없어요.' : filter === 'active' ? '준비·진행 중인 추첨이 없어요.' : '아직 추첨방이 없어요.'}</p>{filter !== 'finished' && <span className={styles.muted}>위에서 새 추첨방을 만들 수 있어요.</span>}</div>}
      </section>
    </div>
  )
}
