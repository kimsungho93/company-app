import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LotteryRoomState } from '../model/useLotteryRoom'
import { WINNER_EXIT_MS } from '../model/drawTiming'
import { LotteryRoom } from './LotteryRoom'

const state = vi.hoisted(() => ({ useRoom: vi.fn(), saveImage: vi.fn() }))

vi.mock('../model/useLotteryRoom', () => ({ useLotteryRoom: () => state.useRoom() }))
vi.mock('./LotteryMachine', () => ({ LotteryMachine: () => <div data-testid="lottery-machine" /> }))
vi.mock('@/shared/lib/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../model/useResultImageDownload', () => ({ useResultImageDownload: () => ({ saveImage: state.saveImage, status: 'idle' }) }))

let game: LotteryRoomState

const setup = (myUserId = 1) => ({
  ...render(<MemoryRouter><LotteryRoom roomId="room" myUserId={myUserId} /></MemoryRouter>),
  user: userEvent.setup(),
})

describe('LotteryRoom permissions and lifecycle', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  beforeEach(() => {
    state.saveImage.mockReset()
    game = {
      room: {
        id: 'room', title: '점심 추첨', hostId: 1, hostName: '선도우', participants: ['선도우', '육이슬'],
        winnerCount: 1, status: 'READY', winners: [], members: [{ userId: 1, name: '선도우' }, { userId: 2, name: '육이슬' }], version: 1,
        serverTime: '2026-09-14T00:00:00Z', nextDrawAt: null, drawId: 1,
      },
      connecting: false, disconnected: false, busy: false, error: null, serverOffsetMs: 0,
      saveSettings: vi.fn().mockResolvedValue(true), start: vi.fn().mockResolvedValue(true),
      reset: vi.fn().mockResolvedValue(true), leave: vi.fn().mockResolvedValue(true), reconnect: vi.fn(),
    }
    state.useRoom.mockImplementation(() => game)
  })

  it('lets the host start but keeps spectator settings read-only', async () => {
    const { user, rerender } = setup()
    await user.click(screen.getByRole('button', { name: '1명 추첨 시작' }))
    expect(game.start).toHaveBeenCalledOnce()
    rerender(<MemoryRouter><LotteryRoom roomId="room" myUserId={2} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /추첨 시작/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText('당첨 인원')).toBeInTheDocument()
    expect(screen.queryByLabelText('이름 추가')).not.toBeInTheDocument()
  })

  it('disables host controls and offers reconnect when the socket disconnects', async () => {
    game.disconnected = true
    const { user } = setup()
    expect(screen.getByRole('button', { name: '1명 추첨 시작' })).toBeDisabled()
    expect(screen.getByLabelText('이름 추가')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '다시 연결' }))
    expect(game.reconnect).toHaveBeenCalledOnce()
  })

  it('distinguishes joining from a failed connection before a snapshot arrives', () => {
    game.room = null
    game.connecting = true
    const { rerender } = setup()
    expect(screen.getByRole('status')).toHaveTextContent('추첨방에 들어가는 중')
    expect(screen.queryByRole('button', { name: '다시 연결' })).not.toBeInTheDocument()
    game = { ...game, connecting: false, disconnected: true, error: '방을 찾을 수 없습니다.' }
    rerender(<MemoryRouter><LotteryRoom roomId="room" myUserId={1} /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('방을 찾을 수 없습니다.')
    expect(screen.getByRole('button', { name: '다시 연결' })).toBeEnabled()
  })

  it('requires host confirmation before clearing the finished results', async () => {
    game.room = { ...game.room!, status: 'FINISHED', winners: [{ name: '육이슬', drawnAt: '2020-01-01T00:00:00Z' }] }
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '새 추첨 준비' }))
    const dialog = screen.getByRole('dialog', { name: '새 추첨을 준비할까요?' })
    expect(game.reset).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(game.reset).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '새 추첨 준비' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '새 추첨 준비' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(game.reset).toHaveBeenCalledOnce()
  })

  it('keeps the reset confirmation open when the server rejects the reset', async () => {
    game.room = { ...game.room!, status: 'FINISHED', winners: [{ name: '육이슬', drawnAt: '2020-01-01T00:00:00Z' }] }
    game.reset = vi.fn().mockResolvedValue(false)
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: '새 추첨 준비' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '새 추첨 준비' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows completed results to spectators without exposing reset controls', () => {
    game.room = { ...game.room!, status: 'FINISHED', winners: [{ name: '육이슬', drawnAt: '2020-01-01T00:00:00Z' }] }
    setup(2)
    expect(screen.getByRole('heading', { name: '오늘의 당첨자' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 추첨 준비' })).not.toBeInTheDocument()
  })

  it('waits for the final ball to reach the tray before announcing completion or offering reset', async () => {
    vi.useFakeTimers()
    const now = Date.parse('2026-09-14T00:00:00Z')
    vi.setSystemTime(now)
    game.room = { ...game.room!, status: 'FINISHED', winners: [{ name: '육이슬', drawnAt: new Date(now).toISOString() }] }
    setup()
    expect(screen.queryByRole('heading', { name: '오늘의 당첨자' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 추첨 준비' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '결과 이미지 저장' })).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(WINNER_EXIT_MS - 1))
    expect(screen.queryByRole('list', { name: '발표 순서대로 당첨자' })).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(21))
    expect(screen.getByRole('heading', { name: '오늘의 당첨자' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '발표 순서대로 당첨자' })).toHaveTextContent('육이슬')
    expect(screen.getByRole('button', { name: '새 추첨 준비' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '결과 이미지 저장' })).toBeEnabled()
  })

  it('copies the announced winners in order without exposing an unannounced winner', async () => {
    const now = Date.now()
    game.room = {
      ...game.room!, status: 'DRAWING', winnerCount: 2,
      winners: [{ name: '육이슬', drawnAt: new Date(now - 10_000).toISOString() }, { name: '선도우', drawnAt: new Date(now).toISOString() }],
    }
    const { user } = setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: '결과 복사' }))
    expect(write).toHaveBeenCalledWith('점심 추첨\n1. 육이슬')
    expect(screen.getByRole('button', { name: '복사됨' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '새 추첨 준비' })).not.toBeInTheDocument()
  })

  it('provides a selectable invite link when clipboard access fails', async () => {
    const { user } = setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await user.click(screen.getByRole('button', { name: '초대 링크 복사' }))
    expect(screen.getByRole('alert')).toHaveTextContent('링크를 직접 선택해 복사해 주세요.')
    expect(screen.getByRole('textbox', { name: '초대 링크' })).toHaveValue(window.location.href)
  })

  it('lets spectators save only the winners already presented on screen', async () => {
    const now = Date.now()
    const presented = { name: '육이슬', drawnAt: new Date(now - 10_000).toISOString() }
    game.room = {
      ...game.room!, status: 'DRAWING', winnerCount: 2,
      winners: [presented, { name: '선도우', drawnAt: new Date(now).toISOString() }],
    }
    const { user } = setup(2)
    await user.click(screen.getByRole('button', { name: '결과 이미지 저장' }))
    expect(state.saveImage).toHaveBeenCalledWith({ title: '점심 추첨', participants: ['선도우', '육이슬'], winners: [presented], winnerCount: 2, finished: false })
    expect(screen.getByRole('button', { name: '결과 복사' })).toBeInTheDocument()
  })
})
