import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, Ref } from 'react'
import { useTheme } from '@/shared/theme'
import type { ChatPerson } from '../../api/chatTypes'
import type { OrbitColors, OrbitPoint, OrbitScene } from './orbitScene'
import styles from './LotteryChat.module.scss'
import { chatColor } from './chatColors'

export type OrbitHandle = { pulse(userId: number): void; getAnchor(userId: number): DOMRect | undefined }
type Props = { members: ChatPerson[]; currentUserId: number; selectedId: number | null; typing: ChatPerson[];
  onSelect(userId: number | null): void; ref?: Ref<OrbitHandle> }

export const OrbitParticipants = ({ members, currentUserId, selectedId, typing, onSelect, ref }: Props) => {
  const host = useRef<HTMLDivElement>(null)
  const buttons = useRef(new Map<number, HTMLButtonElement>())
  const scene = useRef<OrbitScene | null>(null)
  const [ready, setReady] = useState(false)
  const rotation = useRef(0.25)
  const drag = useRef<{ id: number; start: number; last: number; moved: boolean; target: HTMLElement } | null>(null)
  const suppressClickUntil = useRef(0)
  const selectCallback = useRef(onSelect)
  const selection = useRef(selectedId)
  const { resolved: theme } = useTheme()
  selectCallback.current = onSelect
  selection.current = selectedId
  const visible = useMemo(() => {
    const own = members.find(person => person.userId === currentUserId)
    const others = members.filter(person => person.userId !== currentUserId)
    const result = own ? [...others.slice(0, 5), own] : others.slice(0, 6)
    const chosen = members.find(person => person.userId === selectedId)
    if (chosen && !result.some(person => person.userId === chosen.userId)) result[Math.max(0, result.length - (own ? 2 : 1))] = chosen
    return result
  }, [members, currentUserId, selectedId])
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const overflow = members.filter(person => !visible.some(shown => shown.userId === person.userId))
  const participantKey = visible.map(person => `${person.userId}:${person.name}`).join('|')
  const layout = useCallback((points: OrbitPoint[]) => {
    const container = host.current
    if (!container) return
    for (const point of points) {
      const button = buttons.current.get(point.id)
      if (!button) continue
      const x = Math.max(35, Math.min(container.clientWidth - 35, point.x))
      const y = Math.max(25, Math.min(container.clientHeight - 32, point.y))
      button.style.transform = `translate(${x - 34}px, ${y - 22}px)`
      button.style.zIndex = String(Math.max(1, Math.round((1 - point.depth) * 10000)))
      button.style.setProperty('--person-scale', String(point.scale))
    }
  }, [])
  const fallbackLayout = useCallback(() => {
    const container = host.current
    if (!container || scene.current) return
    const width = container.clientWidth || 320
    const people = visibleRef.current
    layout(people.map((person, index) => {
      const angle = index / people.length * Math.PI * 2 + rotation.current
      return { id: person.userId, x: width / 2 + Math.sin(angle) * width * 0.33,
        y: 88 + Math.cos(angle) * 53, scale: 1, depth: -Math.cos(angle) }
    }))
  }, [layout])
  const readColors = useCallback((): OrbitColors => {
    const container = host.current!
    const probe = document.createElement('span')
    container.appendChild(probe)
    const resolve = (token: string) => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color }
    const colors = { background: resolve('--surface'), ring: resolve('--border-input'), platform: resolve('--bg-sunken') }
    probe.remove()
    return colors
  }, [])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    fallbackLayout()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fallbackLayout)
    if (host.current) resize?.observe(host.current)
    void import('./orbitScene').then(({ createLotteryOrbitScene }) => {
      if (cancelled || !host.current) return
      const instance = createLotteryOrbitScene({ host: host.current,
        participants: visibleRef.current.map(person => ({ id: person.userId, name: person.name, color: chatColor(person.userId) })),
        colors: readColors(), onLayout: layout,
        onSelect: id => selectCallback.current(selection.current === id ? null : id),
        onUnavailable: () => { scene.current?.dispose(); scene.current = null; setReady(false); fallbackLayout() },
      })
      scene.current = instance
      instance.select(selection.current)
      setReady(true)
    }).catch(() => { if (!cancelled) { scene.current = null; setReady(false); fallbackLayout() } })
    return () => { cancelled = true; resize?.disconnect(); scene.current?.dispose(); scene.current = null }
  }, [participantKey, fallbackLayout, layout, readColors])
  useEffect(() => { scene.current?.select(selectedId) }, [selectedId, ready])
  const typingId = typing.find(person => visible.some(member => member.userId === person.userId))?.userId ?? null
  useEffect(() => { scene.current?.setTyping(typingId) }, [typingId, ready])
  useEffect(() => { if (scene.current) scene.current.updateColors(readColors()) }, [theme, readColors])
  useImperativeHandle(ref, () => ({ pulse: id => scene.current?.pulse(id), getAnchor: id => buttons.current.get(id)?.getBoundingClientRect() }), [])
  const rotate = (amount: number) => {
    if (scene.current) scene.current.rotateBy(amount)
    else { rotation.current += amount; fallbackLayout() }
  }
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || drag.current) return
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-orbit-person]')
    if (scene.current && !button) return
    const target = button ?? event.currentTarget
    drag.current = { id: event.pointerId, start: event.clientX, last: event.clientX, moved: false, target }
    target.setPointerCapture?.(event.pointerId)
  }
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (Math.abs(event.clientX - current.start) > 5) current.moved = true
    if (current.moved) rotate((event.clientX - current.last) * 0.012)
    current.last = event.clientX
  }
  const pointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (current.moved) suppressClickUntil.current = performance.now() + 250
    drag.current = null
    if (current.target.hasPointerCapture?.(event.pointerId)) current.target.releasePointerCapture(event.pointerId)
  }

  return <div className={styles.orbit}>
    <div ref={host} className={styles.space} data-ready={ready} data-testid="chat-orbit" aria-label="함께 있는 사람의 궤도"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
      {!ready && <div className={styles.fallbackRing} aria-hidden="true" />}
      <div className={styles.projection}>
        {visible.map(person => <button key={person.userId} ref={element => { if (element) buttons.current.set(person.userId, element); else buttons.current.delete(person.userId) }}
          type="button" data-orbit-person={person.userId} data-typing={typing.some(value => value.userId === person.userId)}
          className={styles.person} aria-label={`${person.name}${person.userId === currentUserId ? ', 나' : ''} 대화 보기`}
          aria-pressed={selectedId === person.userId} style={{ '--person-color': chatColor(person.userId) } as CSSProperties}
          onClick={() => { if (performance.now() >= suppressClickUntil.current) onSelect(selectedId === person.userId ? null : person.userId) }}>
          <span className={styles.sphereHit} aria-hidden="true"><span className={styles.fallbackBall} /></span>
          <span className={styles.personName}>{person.userId === currentUserId ? '나' : person.name}</span>
        </button>)}
      </div>
    </div>
    <div className={styles.rotate} aria-label="참여자 궤도 회전">
      <button type="button" className={styles.iconButton} aria-label="궤도를 왼쪽으로 회전" onClick={() => rotate(-0.55)}>←</button>
      <button type="button" className={styles.iconButton} aria-label="궤도를 오른쪽으로 회전" onClick={() => rotate(0.55)}>→</button>
      {overflow.length > 0 && <details className={styles.overflow}><summary>+{overflow.length}명</summary><div>
        {overflow.map(person => <button type="button" key={person.userId} onClick={() => onSelect(person.userId)}>{person.name} 대화 보기</button>)}
      </div></details>}
    </div>
  </div>
}
