import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { Button } from '@/shared/ui/Button'
import { usePrefersReducedMotion } from '@/shared/lib/usePrefersReducedMotion'
import type { ChatDisplayMessage, ChatPerson } from '../../api/chatTypes'
import type { LotteryChatTransport } from '../../model/lotteryChatTransport'
import { useLotteryChat } from '../../model/useLotteryChat'
import { OrbitParticipants } from './OrbitParticipants'
import { chatColor } from './chatColors'
import type { OrbitHandle } from './OrbitParticipants'
import styles from './LotteryChat.module.scss'

type Props = { transport: LotteryChatTransport; currentUser: ChatPerson; members: ChatPerson[] }
const codepoints = (value: string) => Array.from(value)
const timeLabel = (value: string) => new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
const Highlight = ({ text, query }: { text: string; query: string }) => {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1
  return index < 0 ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>
}

const Message = ({ message, own, query, connected, onRetry }: { message: ChatDisplayMessage; own: boolean;
  query: string; connected: boolean; onRetry(id: string): void }) => {
  const [readersOpen, setReadersOpen] = useState(false)
  const readersId = useId()
  return <article className={`${styles.message} ${own ? styles.own : ''}`} data-chat-seq={message.seq}
    data-readable={message.delivery === 'sent'} aria-label={`${message.senderName} ${timeLabel(message.sentAt)}`}>
    {!own && <span className={styles.dot} aria-hidden="true" style={{ '--person-color': chatColor(message.senderId) } as CSSProperties} />}
    <div className={styles.messageContent}>
      {!own && <span className={styles.messageName}>{message.senderName}</span>}
      <p className={styles.bubble}><Highlight text={message.text} query={query} /></p>
      <div className={styles.messageMeta}>
        <time dateTime={message.sentAt}>{timeLabel(message.sentAt)}</time>
        {own && message.delivery === 'sending' && <span>전송 중</span>}
        {own && message.delivery === 'failed' && <button type="button" className={styles.retry} disabled={!connected}
          onClick={() => onRetry(message.clientMessageId)}>전송 실패 · 다시 보내기</button>}
        {own && message.delivery === 'sent' && (message.readers.length ? <button type="button" className={styles.read}
          aria-expanded={readersOpen} aria-controls={readersId} onClick={() => setReadersOpen(value => !value)}>
          <span className={styles.beads} aria-hidden="true">{message.readers.slice(0, 5).map(reader => <span key={reader.userId}
            style={{ '--person-color': chatColor(reader.userId) } as CSSProperties} />)}</span>{message.readers.length}명 읽음
        </button> : <span>전송됨</span>)}
      </div>
      {own && message.delivery === 'failed' && message.failure && <p className={styles.messageFailure}>{message.failure}</p>}
      {own && message.readers.length > 0 && <div id={readersId} className={styles.readerDetail} hidden={!readersOpen}>
        읽은 사람 · {message.readers.map(reader => reader.name).join(', ')}
      </div>}
    </div>
  </article>
}

export const LotteryChatPanel = ({ transport, currentUser, members }: Props) => {
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 900px)').matches)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const chat = useLotteryChat({ transport, currentUser, open })
  const { setTyping } = chat
  const reduced = usePrefersReducedMotion()
  const bodyId = useId(), searchId = useId(), inputId = useId(), titleId = useId()
  const panel = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const sendButton = useRef<HTMLButtonElement>(null)
  const searchField = useRef<HTMLInputElement>(null)
  const searchToggle = useRef<HTMLButtonElement>(null)
  const orbit = useRef<OrbitHandle>(null)
  const composing = useRef(false)
  const pendingSend = useRef(false)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const following = useRef(true)
  const previousView = useRef('')
  const anchor = useRef<{ height: number; top: number; oldest: number } | null>(null)
  const readFrame = useRef(0)
  const live = useRef({ open, markRead: chat.markRead })
  live.current = { open, markRead: chat.markRead }
  const flights = useRef(new Map<Animation, HTMLElement>())
  const count = codepoints(draft).length
  const selectedPerson = members.find(person => person.userId === chat.senderId)
  const selectedName = selectedPerson?.name ?? chat.messages.find(message => message.senderId === chat.senderId)?.senderName ?? '선택한 사람'

  const requestRead = useCallback(() => {
    if (readFrame.current || !live.current.open || document.visibilityState !== 'visible') return
    readFrame.current = requestAnimationFrame(() => {
      readFrame.current = 0
      const container = list.current
      if (!container || !live.current.open || document.visibilityState !== 'visible') return
      const bounds = container.getBoundingClientRect()
      const top = Math.max(0, bounds.top), bottom = Math.min(window.innerHeight, bounds.bottom)
      const left = Math.max(0, bounds.left), right = Math.min(window.innerWidth, bounds.right)
      if (bottom <= top || right <= left) return
      const seqs = [...container.querySelectorAll<HTMLElement>('[data-readable="true"]')].filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.height > 0 && rect.width > 0 && Math.min(rect.bottom, bottom) - Math.max(rect.top, top) >= Math.min(rect.height, bottom - top) * 0.6
          && Math.min(rect.right, right) > Math.max(rect.left, left)
      }).map(element => Number(element.dataset.chatSeq)).filter(seq => seq > 0).slice(0, 100)
      if (seqs.length) live.current.markRead(seqs)
    })
  }, [])
  useEffect(() => {
    if (!open || !list.current) return
    const visibility = () => { if (document.visibilityState === 'visible') requestRead(); else setTyping(false) }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(requestRead, { threshold: [0, 0.6, 1] })
    list.current.querySelectorAll('[data-readable="true"]').forEach(element => observer?.observe(element))
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(requestRead)
    resize?.observe(list.current)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('scroll', requestRead, true)
    window.addEventListener('resize', requestRead)
    requestRead()
    return () => { observer?.disconnect(); resize?.disconnect(); document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('scroll', requestRead, true); window.removeEventListener('resize', requestRead)
      cancelAnimationFrame(readFrame.current); readFrame.current = 0 }
  }, [chat.messages, setTyping, open, requestRead])
  useLayoutEffect(() => {
    const container = list.current
    if (!container) return
    const view = `${chat.query}:${chat.senderId}`
    if (previousView.current !== view) { previousView.current = view; following.current = true; anchor.current = null }
    const saved = anchor.current
    if (saved && !chat.loadingOlder) {
      if (chat.messages[0]?.seq !== saved.oldest) container.scrollTop = saved.top + container.scrollHeight - saved.height
      anchor.current = null
    } else if (!saved && following.current) container.scrollTop = container.scrollHeight
    const bottom = container.scrollHeight - container.scrollTop - container.clientHeight < 48
    following.current = bottom; setAtBottom(bottom); requestRead()
  }, [chat.messages, chat.query, chat.senderId, chat.loadingOlder, open, requestRead])
  useEffect(() => {
    if (!composer.current) return
    composer.current.style.height = '40px'
    composer.current.style.height = `${Math.min(composer.current.scrollHeight || 40, 132)}px`
  }, [draft, open, searchOpen])
  useEffect(() => () => { for (const [animation, element] of flights.current) { animation.cancel(); element.remove() } flights.current.clear() }, [])

  const flyToOrbit = () => {
    const host = panel.current, start = sendButton.current?.getBoundingClientRect(), finish = orbit.current?.getAnchor(currentUser.userId)
    if (!host || !start || !finish || reduced || typeof Element.prototype.animate !== 'function') { orbit.current?.pulse(currentUser.userId); return }
    const bounds = host.getBoundingClientRect(), ball = document.createElement('span')
    ball.className = styles.flight; ball.setAttribute('aria-hidden', 'true'); host.appendChild(ball)
    const sx = start.left - bounds.left + start.width / 2 - 7, sy = start.top - bounds.top + start.height / 2 - 7
    const fx = finish.left - bounds.left + finish.width / 2 - 7, fy = finish.top - bounds.top + 16
    const animation = ball.animate([{ transform: `translate(${sx}px, ${sy}px) scale(.7)`, opacity: 0.8 },
      { transform: `translate(${sx + 25}px, ${(sy + fy) / 2}px) scale(1.1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${fx}px, ${fy}px) scale(.3)`, opacity: 0.4 }], { duration: 580, easing: 'cubic-bezier(.3,.65,.3,1)' })
    flights.current.set(animation, ball)
    void animation.finished.then(() => { orbit.current?.pulse(currentUser.userId) }).catch(() => undefined)
      .finally(() => { flights.current.delete(animation); ball.remove() })
  }
  const cancelPendingSend = () => {
    pendingSend.current = false
    clearTimeout(sendTimer.current)
    sendTimer.current = undefined
  }
  useEffect(() => {
    const input = composer.current
    const preventPendingNewline = (event: InputEvent) => {
      if (pendingSend.current && (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph')) event.preventDefault()
    }
    input?.addEventListener('beforeinput', preventPendingNewline)
    return () => {
      input?.removeEventListener('beforeinput', preventPendingNewline)
      cancelPendingSend()
    }
  }, [open, chat.connected])

  const send = () => {
    const value = composer.current?.value ?? draft
    if (composing.current || !chat.connected || !value.trim() || codepoints(value).length > 300) return
    if (!chat.send(value.trim())) return
    cancelPendingSend()
    if (composer.current) composer.current.value = ''
    following.current = true; anchor.current = null
    setDraft(''); setDraftError(null); chat.setTyping(false); flyToOrbit()
    if (chat.senderId !== null) chat.filterSender(null)
    if (chat.query) chat.search('')
    setSearchInput(''); setSearchOpen(false); composer.current?.focus({ preventScroll: true })
  }
  const scheduleSend = () => {
    clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      sendTimer.current = undefined
      if (!pendingSend.current || composing.current) return
      pendingSend.current = false
      send()
    }, 0)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) { cancelPendingSend(); return }
    if (event.repeat) { event.preventDefault(); return }
    pendingSend.current = true
    if (event.nativeEvent.isComposing || composing.current) return
    if (event.keyCode !== 229) event.preventDefault()
    scheduleSend()
  }
  const toggleSearch = () => {
    if (searchOpen) { setSearchOpen(false); setSearchInput(''); chat.search(''); searchToggle.current?.focus({ preventScroll: true }) }
    else { setSearchOpen(true); requestAnimationFrame(() => searchField.current?.focus({ preventScroll: true })) }
  }
  const mention = () => {
    if (!selectedPerson || selectedPerson.userId === currentUser.userId) return
    const prefix = `@${selectedPerson.name} `
    const next = draft.startsWith(prefix) ? draft : prefix + draft
    if (codepoints(next).length > 300) {
      setDraftError('언급을 넣을 공간이 부족해요. 메시지를 조금 줄여 주세요.')
      return
    }
    setDraft(next); setDraftError(null)
    requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }))
  }
  const loadOlder = () => {
    const container = list.current
    if (!container || chat.loadingOlder) return
    anchor.current = { height: container.scrollHeight, top: container.scrollTop, oldest: chat.messages[0]?.seq ?? 0 }
    following.current = false; chat.loadOlder()
  }
  const jumpToLatest = () => {
    following.current = true; anchor.current = null
    if (chat.query || chat.senderId !== null) { setSearchInput(''); chat.search(''); chat.filterSender(null) }
    if (list.current) list.current.scrollTop = list.current.scrollHeight
    setAtBottom(true); requestRead()
  }
  const toggleOpen = () => { if (open) chat.setTyping(false); setOpen(value => !value) }

  return <section ref={panel} className={styles.panel} aria-labelledby={titleId} data-lottery-chat="true">
    <header className={styles.header}>
      <h2 id={titleId}>채팅</h2><span className={styles.online}>{members.length}명 함께</span>
      {!open && chat.unreadCount > 0 && <span className={styles.unreadCount}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
      {open && <button ref={searchToggle} type="button" className={styles.iconButton} aria-label={searchOpen ? '메시지 검색 닫기' : '메시지 검색 열기'}
        aria-expanded={searchOpen} aria-controls={searchId} onClick={toggleSearch}>{searchOpen ? '닫기' : '검색'}</button>}
      <button type="button" className={styles.iconButton} aria-label={open ? '채팅 접기' : '채팅 펼치기'} aria-expanded={open} aria-controls={bodyId} onClick={toggleOpen}>{open ? '⌃' : '⌄'}</button>
    </header>
    <div id={bodyId} hidden={!open}>
      {open && <>
        {!searchOpen && <OrbitParticipants ref={orbit} members={members} currentUserId={currentUser.userId} selectedId={chat.senderId} typing={chat.typing} onSelect={chat.filterSender} />}
        <div className={styles.viewbar}><span>{chat.senderId === null ? '전체 대화' : `${selectedName}의 대화`}</span><div>
          {selectedPerson && selectedPerson.userId !== currentUser.userId && <button type="button" className={styles.textButton} onClick={mention}>언급하기</button>}
          {chat.senderId !== null && <button type="button" className={styles.textButton} onClick={() => chat.filterSender(null)}>모두 보기</button>}
        </div></div>
        {searchOpen && <div id={searchId} className={styles.search}>
          <input ref={searchField} type="search" aria-label="메시지 검색" placeholder="메시지 검색" value={searchInput} maxLength={100}
            onChange={event => { setSearchInput(event.target.value); chat.search(event.target.value) }} onKeyDown={event => { if (event.key === 'Escape') toggleSearch() }} />
          <span>최근 1,000개 메시지에서 검색</span>
        </div>}
        {!chat.connected && <p className={styles.connection} role="status">연결을 기다리고 있어요. 작성 중인 메시지는 유지됩니다.</p>}
        {chat.error && <div className={styles.error}><p role="alert">{chat.error}</p><button type="button" className={styles.textButton} disabled={!chat.connected} onClick={() => chat.search(chat.query)}>다시 불러오기</button></div>}
        <div ref={list} className={styles.messages} aria-label="대화 목록" aria-busy={chat.loading || chat.loadingOlder}
          onScroll={() => { const element = list.current!; const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48
            following.current = bottom; setAtBottom(bottom); requestRead() }}>
          {chat.hasMore && <Button variant="secondary" className={styles.older} loading={chat.loadingOlder} onClick={loadOlder}>이전 메시지 보기</Button>}
          {chat.loading && <p className={styles.empty} role="status">대화를 불러오는 중…</p>}
          {!chat.loading && chat.connected && !chat.error && chat.messages.length === 0 && <p className={styles.empty}>{chat.query || chat.senderId !== null ? '일치하는 메시지가 없어요.' : '첫 메시지를 남겨 보세요.'}</p>}
          {chat.messages.map(message => <Message key={`${message.senderId}:${message.clientMessageId || message.id}`} message={message} own={message.senderId === currentUser.userId}
            query={chat.query} connected={chat.connected} onRetry={chat.retry} />)}
        </div>
        {!atBottom && <button type="button" className={styles.jump} onClick={jumpToLatest}>{chat.unreadCount ? `새 메시지 ${chat.unreadCount}개` : '최신 대화로'} ↓</button>}
        <div className={styles.typing} role="status">{chat.typing.length > 0 && `${chat.typing.slice(0, 2).map(person => person.name).join(', ')}${chat.typing.length > 2 ? ` 외 ${chat.typing.length - 2}명` : ''} 입력 중…`}</div>
        {draftError && <p className={styles.draftError} role="alert">{draftError}</p>}
        <form className={styles.compose} aria-label="메시지 작성" onSubmit={event => { event.preventDefault(); send() }}>
          <div><label className={styles.srOnly} htmlFor={inputId}>메시지 작성</label>
            <textarea ref={composer} id={inputId} rows={1} value={draft} placeholder="메시지 입력" onKeyDown={onKeyDown}
              onChange={event => { const value = composing.current ? event.target.value : codepoints(event.target.value).slice(0, 300).join(''); setDraft(value); setDraftError(null); chat.setTyping(!!value.trim()) }}
              onCompositionStart={() => { cancelPendingSend(); composing.current = true }}
              onCompositionEnd={event => { composing.current = false; setDraft(codepoints(event.currentTarget.value).slice(0, 300).join('')); if (pendingSend.current) scheduleSend() }}
              onBlur={() => { cancelPendingSend(); composing.current = false; chat.setTyping(false) }} />
            {count >= 240 && <span className={styles.count} aria-label={`${count}자, 최대 300자`}>{count} / 300</span>}
          </div>
          <button ref={sendButton} type="submit" className={styles.send} aria-label="메시지 보내기" disabled={!chat.connected || !draft.trim() || count > 300}>↑</button>
        </form>
      </>}
    </div>
  </section>
}
