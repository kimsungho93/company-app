import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useImperativeHandle } from 'react'
import type { Ref } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatDisplayMessage, ChatPerson } from '../../api/chatTypes'
import type { LotteryChatState } from '../../model/useLotteryChat'
import { createLotteryChatTransport } from '../../model/lotteryChatTransport'
import type { OrbitHandle } from './OrbitParticipants'
import { LotteryChatPanel } from './LotteryChatPanel'

const state = vi.hoisted(() => ({ useChat: vi.fn(), pulse: vi.fn() }))
vi.mock('../../model/useLotteryChat', () => ({ useLotteryChat: (props: unknown) => state.useChat(props) }))
vi.mock('@/shared/lib/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => true }))
vi.mock('./OrbitParticipants', () => ({
  chatColor: () => '#346de0',
  OrbitParticipants: ({ members, onSelect, ref }: { members: ChatPerson[]; onSelect(id: number): void; ref: Ref<OrbitHandle> }) => {
    useImperativeHandle(ref, () => ({ pulse: state.pulse, getAnchor: () => undefined }))
    return <div>{members.map(person => <button type="button" key={person.userId} onClick={() => onSelect(person.userId)}>{person.name} 대화 보기</button>)}</div>
  },
}))

const members = [{ userId: 1, name: '선도우' }, { userId: 2, name: '육이슬' }]
const transport = createLotteryChatTransport('room')
const makeMessage = (seq: number, overrides: Partial<ChatDisplayMessage> = {}): ChatDisplayMessage => ({
  id: `message-${seq}`, seq, clientMessageId: `client-${seq}`, senderId: 2, senderName: '육이슬', text: `메시지 ${seq}`,
  sentAt: '2026-09-15T12:00:00Z', readers: [], delivery: 'sent', ...overrides,
})
let chat: LotteryChatState
const view = () => <LotteryChatPanel transport={transport} currentUser={members[0]} members={members} />
const rect = (top: number, height: number, width = 320) => ({ top, bottom: top + height, left: 0, right: width, x: 0, y: top, width, height, toJSON: () => ({}) })

describe('LotteryChatPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    state.pulse.mockReset()
    chat = { messages: [], connected: true, loading: false, loadingOlder: false, hasMore: false, error: null,
      query: '', senderId: null, typing: [], latestSeq: 0, unreadCount: 0, send: vi.fn().mockReturnValue(true),
      retry: vi.fn().mockReturnValue(true), loadOlder: vi.fn(), search: vi.fn(), filterSender: vi.fn(), markRead: vi.fn(),
      setTyping: vi.fn(), clearError: vi.fn() }
    state.useChat.mockImplementation(() => chat)
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('clears a locally accepted draft, pulses the own sphere, and preserves a rejected or disconnected draft', async () => {
    const user = userEvent.setup(), { rerender } = render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    await user.type(input, '함께 응원해요')
    await user.click(screen.getByRole('button', { name: '메시지 보내기' }))
    expect(chat.send).toHaveBeenCalledWith('함께 응원해요')
    expect(input).toHaveValue('')
    expect(state.pulse).toHaveBeenCalledWith(1)
    chat.send = vi.fn().mockReturnValue(false)
    await user.type(input, '다시 연결되면 보낼 내용')
    await user.click(screen.getByRole('button', { name: '메시지 보내기' }))
    expect(input).toHaveValue('다시 연결되면 보낼 내용')
    chat = { ...chat, connected: false }; rerender(view())
    expect(screen.getByRole('button', { name: '메시지 보내기' })).toBeDisabled()
    expect(input).toHaveValue('다시 연결되면 보낼 내용')
    expect(screen.getByText(/연결을 기다리고 있어요/)).toHaveAttribute('role', 'status')
  })

  it('sends once with Enter and keeps focus in the empty composer', async () => {
    const user = userEvent.setup(); render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    await user.type(input, '바로 보내기{Enter}')
    expect(chat.send).toHaveBeenCalledExactlyOnceWith('바로 보내기')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
  })

  it('sends the completed Korean text after a single composing Enter', async () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '마지막 그' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(chat.send).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { data: '글', target: { value: '마지막 글' } })
    await waitFor(() => expect(chat.send).toHaveBeenCalledExactlyOnceWith('마지막 글'))
    expect(input).toHaveValue('')
    fireEvent.input(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(chat.send).toHaveBeenCalledTimes(1)
    expect(input).toHaveValue('')
  })

  it('sends Enter immediately when compositionend arrives before keydown', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '완성한 한그' } })
    fireEvent.compositionEnd(input)
    expect(chat.send).not.toHaveBeenCalled()
    expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })).toBe(true)
    fireEvent.input(input, { target: { value: '완성한 한글' }, inputType: 'insertCompositionText' })
    await waitFor(() => expect(chat.send).toHaveBeenCalledExactlyOnceWith('완성한 한글'))
  })

  it('does not send when composition ends without Enter or with Shift+Enter', () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '첫 줄' } })
    fireEvent.compositionEnd(input)
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true, isComposing: true })
    fireEvent.compositionEnd(input)
    expect(chat.send).not.toHaveBeenCalled()
    expect(input).toHaveValue('첫 줄')
  })

  it('preserves the completed Korean draft when sending fails or the connection is lost', async () => {
    chat.send = vi.fn().mockReturnValue(false)
    const { rerender } = render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '보관할 그' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.compositionEnd(input, { target: { value: '보관할 글' } })
    await waitFor(() => expect(chat.send).toHaveBeenCalledExactlyOnceWith('보관할 글'))
    expect(input).toHaveValue('보관할 글')
    vi.mocked(chat.send).mockClear()
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    chat = { ...chat, connected: false }; rerender(view())
    chat = { ...chat, connected: true }; rerender(view())
    fireEvent.compositionEnd(input)
    expect(chat.send).not.toHaveBeenCalled()
    expect(input).toHaveValue('보관할 글')
  })

  it('cancels a pending composition send on blur or a new composition', () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '작성 중' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.blur(input)
    fireEvent.compositionEnd(input)
    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.compositionStart(input)
    fireEvent.compositionEnd(input)
    expect(chat.send).not.toHaveBeenCalled()
  })

  it('uses the final input event after compositionend and prevents an Enter newline', async () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '한그' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.compositionEnd(input)
    fireEvent.input(input, { target: { value: '한글' }, inputType: 'insertCompositionText' })
    const newline = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertLineBreak' })
    fireEvent(input, newline)
    expect(newline.defaultPrevented).toBe(true)
    await waitFor(() => expect(chat.send).toHaveBeenCalledExactlyOnceWith('한글'))
    expect(input).toHaveValue('')
  })

  it('cancels a queued Enter when typing continues and ignores held Enter', async () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.change(input, { target: { value: '작성 중' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'a' })
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
    expect(chat.send).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter', repeat: true })
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
    expect(chat.send).not.toHaveBeenCalled()
    expect(input).toHaveValue('작성 중')
  })
  it('counts Unicode code points, shows the counter at 240, and caps the draft at 300', () => {
    render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.change(input, { target: { value: '🙂'.repeat(239) } })
    expect(screen.queryByText(/\/ 300/)).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '🙂'.repeat(240) } })
    expect(screen.getByText('240 / 300')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '🙂'.repeat(301) } })
    expect(input).toHaveValue('🙂'.repeat(300))
    expect(screen.getByText('300 / 300')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }))
    expect(chat.send).toHaveBeenCalledWith('🙂'.repeat(300))
  })

  it('keeps Shift+Enter as an editable newline', async () => {
    const user = userEvent.setup(); render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    await user.type(input, '첫 줄')
    await user.keyboard('{Shift>}{Enter}{/Shift}둘째 줄')
    expect(input).toHaveValue('첫 줄\n둘째 줄')
    expect(chat.send).not.toHaveBeenCalled()
  })

  it('filters on a real person, inserts a public mention, and sends search terms to the model', async () => {
    const user = userEvent.setup(), { rerender } = render(view())
    await user.click(screen.getByRole('button', { name: '육이슬 대화 보기' }))
    expect(chat.filterSender).toHaveBeenCalledWith(2)
    chat = { ...chat, senderId: 2 }; rerender(view())
    await user.type(screen.getByRole('textbox', { name: '메시지 작성' }), '행운을 빌어요')
    await user.click(screen.getByRole('button', { name: '언급하기' }))
    expect(screen.getByRole('textbox', { name: '메시지 작성' })).toHaveValue('@육이슬 행운을 빌어요')
    await user.click(screen.getByRole('button', { name: '메시지 검색 열기' }))
    fireEvent.change(screen.getByRole('searchbox', { name: '메시지 검색' }), { target: { value: '행운' } })
    expect(chat.search).toHaveBeenCalledWith('행운')
    expect(screen.getByText('최근 1,000개 메시지에서 검색')).toBeInTheDocument()
  })

  it('reveals actual reader names and retries a failed message by its original client id', async () => {
    chat.messages = [makeMessage(1, { senderId: 1, senderName: '선도우', readers: [members[1]] }),
      makeMessage(-1, { senderId: 1, senderName: '선도우', delivery: 'failed', failure: '전송을 확인하지 못했어요.' })]
    const user = userEvent.setup(); render(view())
    expect(screen.getByText('읽은 사람 · 육이슬')).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: '1명 읽음' }))
    expect(screen.getByText('읽은 사람 · 육이슬')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '전송 실패 · 다시 보내기' }))
    expect(chat.retry).toHaveBeenCalledWith('client--1')
  })

  it('acknowledges only actually visible message sequences and stops when collapsed or hidden', async () => {
    chat.messages = [makeMessage(1), makeMessage(2), makeMessage(3)]
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('aria-label') === '대화 목록') return rect(0, 280)
      if (this.dataset.chatSeq === '1') return rect(-80, 60)
      if (this.dataset.chatSeq === '2') return rect(70, 60)
      if (this.dataset.chatSeq === '3') return rect(300, 60)
      return rect(0, 0)
    })
    const user = userEvent.setup(); render(view())
    await waitFor(() => expect(chat.markRead).toHaveBeenCalledWith([2]))
    vi.mocked(chat.markRead).mockClear()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    fireEvent.scroll(window)
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)))
    expect(chat.markRead).not.toHaveBeenCalled()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    await user.click(screen.getByRole('button', { name: '채팅 접기' }))
    fireEvent.scroll(window)
    await act(async () => new Promise(resolve => setTimeout(resolve, 25)))
    expect(chat.markRead).not.toHaveBeenCalled()
  })

  it('keeps the scroll position while reading older messages and offers an explicit latest jump', async () => {
    chat.messages = [makeMessage(1), makeMessage(2)]
    const user = userEvent.setup(), { rerender } = render(view())
    const container = screen.getByLabelText('대화 목록')
    Object.defineProperties(container, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 280 } })
    container.scrollTop = 40; fireEvent.scroll(container)
    chat = { ...chat, messages: [...chat.messages, makeMessage(3)], unreadCount: 1 }; rerender(view())
    expect(container.scrollTop).toBe(40)
    await user.click(screen.getByRole('button', { name: '새 메시지 1개 ↓' }))
    expect(container.scrollTop).toBe(1000)
  })

  it('preserves the visible anchor when an older server page is prepended', async () => {
    chat.messages = [makeMessage(101), makeMessage(102)]; chat.hasMore = true
    let height = 1000
    const user = userEvent.setup(), { rerender } = render(view())
    const container = screen.getByLabelText('대화 목록')
    Object.defineProperties(container, { scrollHeight: { configurable: true, get: () => height }, clientHeight: { configurable: true, value: 280 } })
    container.scrollTop = 50; fireEvent.scroll(container)
    await user.click(screen.getByRole('button', { name: '이전 메시지 보기' }))
    expect(chat.loadOlder).toHaveBeenCalledOnce()
    chat = { ...chat, loadingOlder: true }; rerender(view())
    height = 1200
    chat = { ...chat, loadingOlder: false, messages: [makeMessage(100), ...chat.messages] }; rerender(view())
    expect(container.scrollTop).toBe(250)
  })

  it('starts collapsed on mobile and preserves the draft across collapse', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList)
    const user = userEvent.setup(); render(view())
    expect(screen.queryByRole('textbox', { name: '메시지 작성' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '채팅 펼치기' }))
    await user.type(screen.getByRole('textbox', { name: '메시지 작성' }), '남겨 둔 초안')
    await user.click(screen.getByRole('button', { name: '채팅 접기' }))
    await user.click(screen.getByRole('button', { name: '채팅 펼치기' }))
    expect(screen.getByRole('textbox', { name: '메시지 작성' })).toHaveValue('남겨 둔 초안')
  })

  it('preserves the complete draft when a mention would exceed the limit', async () => {
    chat.senderId = 2
    const user = userEvent.setup(); render(view())
    const input = screen.getByRole('textbox', { name: '메시지 작성' })
    fireEvent.change(input, { target: { value: '가'.repeat(298) } })
    await user.click(screen.getByRole('button', { name: '언급하기' }))
    expect(input).toHaveValue('가'.repeat(298))
    expect(screen.getByRole('alert')).toHaveTextContent('언급을 넣을 공간이 부족')
  })

  it('returns to the full conversation and follows the sent message after a filtered send', async () => {
    chat.senderId = 2; chat.query = '행운'; chat.messages = [makeMessage(2)]
    const user = userEvent.setup(), { rerender } = render(view())
    const container = screen.getByLabelText('대화 목록')
    Object.defineProperties(container, { scrollHeight: { configurable: true, value: 1000 }, clientHeight: { configurable: true, value: 280 } })
    container.scrollTop = 30; fireEvent.scroll(container)
    await user.type(screen.getByRole('textbox', { name: '메시지 작성' }), '@육이슬 행운을 빌어요')
    await user.click(screen.getByRole('button', { name: '메시지 보내기' }))
    expect(chat.filterSender).toHaveBeenCalledWith(null)
    expect(chat.search).toHaveBeenCalledWith('')
    chat = { ...chat, senderId: null, query: '', messages: [...chat.messages, makeMessage(3, { senderId: 1 })] }
    rerender(view())
    expect(container.scrollTop).toBe(1000)
  })

  it('keeps a failed history state visible and requests the same query again', async () => {
    chat.error = '대화를 불러오지 못했어요.'; chat.query = '행운'
    const user = userEvent.setup(); render(view())
    expect(screen.queryByText('첫 메시지를 남겨 보세요.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(chat.search).toHaveBeenCalledWith('행운')
    expect(chat.clearError).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('대화를 불러오지 못했어요.')
  })

  it('acknowledges a long message when it fills the visible list area', async () => {
    chat.messages = [makeMessage(7, { text: '긴 메시지\n'.repeat(50) })]
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('aria-label') === '대화 목록') return rect(0, 280)
      if (this.dataset.chatSeq === '7') return rect(30, 900)
      return rect(0, 0)
    })
    render(view())
    await waitFor(() => expect(chat.markRead).toHaveBeenCalledWith([7]))
  })
})
