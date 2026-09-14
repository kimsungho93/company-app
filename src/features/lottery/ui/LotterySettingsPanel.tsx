import { useId, useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import type { LotteryRoomSnapshot, LotterySettings } from '../api/types'
import { validateLotterySettings } from '../model/participants'
import { ballColor } from './machine/ballColors'
import styles from './LotterySettingsPanel.module.scss'

interface Props {
  room: LotteryRoomSnapshot
  isHost: boolean
  busy: boolean
  connected: boolean
  onSave: (settings: LotterySettings) => Promise<boolean>
  onStart: (settings?: LotterySettings) => Promise<boolean>
}

export const LotterySettingsPanel = ({ room, isHost, busy, connected, onSave, onStart }: Props) => {
  const inputId = useId()
  const countId = useId()
  const headingId = useId()
  const errorId = useId()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef(false)
  const [names, setNames] = useState(room.participants)
  const [winnerCount, setWinnerCount] = useState(String(room.winnerCount))
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const editable = isHost && room.status === 'READY'
  const locked = !editable || busy || submitting || !connected
  const draft = { participants: names, winnerCount: Number(winnerCount) }
  const dirty = JSON.stringify(names) !== JSON.stringify(room.participants) || Number(winnerCount) !== room.winnerCount
  const invalid = validateLotterySettings(draft)
  const countLabel = Number.isInteger(draft.winnerCount) && draft.winnerCount > 0 ? draft.winnerCount : room.winnerCount

  const add = () => {
    if (locked) return
    const trimmed = name.trim().normalize('NFC')
    if (!trimmed) { setError('추가할 이름을 입력해 주세요.'); return }
    if (trimmed.length > 30) { setError('이름은 30자까지 입력할 수 있어요.'); return }
    if (names.includes(trimmed)) { setError('이미 명단에 있는 이름이에요.'); return }
    if (names.length >= 50) { setError('최대 50명까지 넣을 수 있어요.'); return }
    setNames([...names, trimmed])
    setName('')
    setError(null)
    inputRef.current?.focus()
  }

  const remove = (person: string) => {
    if (locked) return
    const remaining = names.filter((item) => item !== person)
    setNames(remaining)
    if (draft.winnerCount > remaining.length) setWinnerCount(String(Math.max(1, remaining.length)))
    setError(null)
  }

  const adjustCount = (change: number) => {
    if (locked || !names.length) return
    const current = Number.isFinite(draft.winnerCount) ? Math.trunc(draft.winnerCount) : 1
    setWinnerCount(String(Math.min(names.length, Math.max(1, current + change))))
    setError(null)
  }

  const submit = async (startAfterSave: boolean) => {
    if (locked || pendingRef.current) return
    if (name.trim()) {
      setError('입력한 이름을 먼저 추가해 주세요.')
      if (detailsRef.current) detailsRef.current.open = true
      inputRef.current?.focus()
      return
    }
    if (invalid) { setError(invalid); return }
    pendingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      if (startAfterSave) {
        if (dirty) await onStart(draft)
        else await onStart()
      } else {
        await onSave(draft)
      }
    } catch {
      setError('요청을 완료하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      pendingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <details ref={detailsRef} className={styles.roster}>
        <summary id={headingId}>추첨 명단 <span>· {names.length}명</span></summary>
        <div className={styles.rosterBody}>
          <ul className={styles.names} aria-label="추첨 대상 명단">{names.map((person, index) => (
            <li key={person}>
              <span className={styles.colorDot} style={{ backgroundColor: ballColor(index) }} aria-hidden="true" />
              <span className={styles.personName}>{person}</span>
              {editable && <button type="button" disabled={locked} aria-label={`${person} 명단에서 빼기`} onClick={() => remove(person)}>×</button>}
            </li>
          ))}</ul>
          {editable && <form onSubmit={(event) => { event.preventDefault(); add() }} className={styles.addForm}>
            <label htmlFor={inputId}>이름 추가</label>
            <div>
              <input ref={inputRef} id={inputId} value={name} maxLength={30} placeholder="이름 입력" autoComplete="off" disabled={locked || names.length >= 50} aria-describedby={error ? errorId : undefined} onChange={(event) => { setName(event.target.value); setError(null) }} />
              <Button type="submit" variant="secondary" disabled={locked || names.length >= 50}>추가</Button>
            </div>
          </form>}
        </div>
      </details>
      {editable ? <>
        <div className={styles.countField}>
          <label htmlFor={countId}>당첨 인원</label>
          <div className={styles.stepper}>
            <button type="button" aria-label="당첨 인원 줄이기" disabled={locked || !names.length || draft.winnerCount <= 1} onClick={() => adjustCount(-1)}>−</button>
            <input id={countId} type="number" min={1} max={Math.max(1, names.length)} step={1} value={winnerCount} disabled={locked || !names.length} aria-invalid={!!invalid} aria-describedby={invalid && dirty ? errorId : undefined} onChange={(event) => { setWinnerCount(event.target.value); setError(null) }} />
            <button type="button" aria-label="당첨 인원 늘리기" disabled={locked || !names.length || draft.winnerCount >= names.length} onClick={() => adjustCount(1)}>+</button>
          </div>
        </div>
        {(error || (dirty && invalid)) && <p id={errorId} className={styles.error} role="alert">{error ?? invalid}</p>}
        <div className={styles.actions}>
          <Button fullWidth size="large" loading={busy || submitting} disabled={locked || !!invalid} onClick={() => void submit(true)}>{dirty ? `저장하고 ${countLabel}명 추첨` : `${countLabel}명 추첨 시작`}</Button>
          {dirty && <button type="button" className={styles.saveOnly} disabled={locked || !!invalid} onClick={() => void submit(false)}>명단만 저장</button>}
        </div>
      </> : <div className={styles.readOnlyCount}><span>당첨 인원</span><strong>{room.winnerCount}명</strong></div>}
    </section>
  )
}
