import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LotteryRoomSummary } from '../api/types'
import { LotteryLobby } from './LotteryLobby'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
}))
vi.mock('../api/lotteryApi', () => ({
  useCreateLotteryRoomMutation: () => [mocks.create, { isLoading: false }],
}))
vi.mock('../model/useLotteryLobby', () => ({
  useLotteryLobby: () => ({ connectionStatus: 'connected', ...mocks.list() }),
}))
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mocks.navigate,
}))

const rooms: LotteryRoomSummary[] = [
  {
    id: 'finished',
    title: '어제의 추첨',
    hostId: 1,
    hostName: '선도우',
    status: 'FINISHED',
    memberCount: 2,
    participantCount: 13,
    winnerCount: 1,
  },
  {
    id: 'ready',
    title: '점심 추첨',
    hostId: 1,
    hostName: '선도우',
    status: 'READY',
    memberCount: 2,
    participantCount: 13,
    winnerCount: 2,
  },
  {
    id: 'drawing',
    title: '오늘의 추첨',
    hostId: 2,
    hostName: '육이슬',
    status: 'DRAWING',
    memberCount: 3,
    participantCount: 13,
    winnerCount: 3,
  },
]

const setup = () => ({
  ...render(
    <MemoryRouter>
      <LotteryLobby />
    </MemoryRouter>,
  ),
  user: userEvent.setup(),
})

describe('LotteryLobby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockReturnValue({
      data: rooms,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    })
    mocks.create.mockResolvedValue({ data: { id: 'new-room' } })
    mocks.refetch.mockResolvedValue({ data: rooms })
  })

  it('keeps the refresh button idle while the room list updates in the background', () => {
    const { rerender } = setup()
    const refreshButton = screen.getByRole('button', { name: '추첨방 목록 새로고침' })

    for (const isFetching of [true, false, true, false]) {
      mocks.list.mockReturnValue({
        data: rooms,
        isLoading: false,
        isFetching,
        isError: false,
        refetch: mocks.refetch,
      })
      rerender(
        <MemoryRouter>
          <LotteryLobby />
        </MemoryRouter>,
      )

      expect(refreshButton).toBeEnabled()
      expect(refreshButton).not.toHaveAttribute('aria-busy', 'true')
      expect(refreshButton).toHaveTextContent('새로고침')
      expect(screen.getAllByRole('link')).toHaveLength(3)
    }

    expect(mocks.refetch).not.toHaveBeenCalled()
  })

  it('shows the refresh button as busy only until a manual refresh finishes', async () => {
    let resolve!: (value: { data: LotteryRoomSummary[] }) => void
    const request = new Promise<{ data: LotteryRoomSummary[] }>((done) => {
      resolve = done
    })
    mocks.refetch.mockReturnValueOnce(request)
    const { user } = setup()
    const refreshButton = screen.getByRole('button', { name: '추첨방 목록 새로고침' })

    await user.click(refreshButton)

    expect(refreshButton).toBeDisabled()
    expect(refreshButton).toHaveAttribute('aria-busy', 'true')
    await user.click(refreshButton)
    expect(mocks.refetch).toHaveBeenCalledOnce()

    await act(async () => {
      resolve({ data: rooms })
      await request
    })

    expect(refreshButton).toBeEnabled()
    expect(refreshButton).not.toHaveAttribute('aria-busy', 'true')
  })

  it('allows another manual refresh after an error response', async () => {
    let resolve!: (value: { error: { status: number } }) => void
    const request = new Promise<{ error: { status: number } }>((done) => {
      resolve = done
    })
    mocks.refetch.mockReturnValueOnce(request)
    const { user } = setup()
    const refreshButton = screen.getByRole('button', { name: '추첨방 목록 새로고침' })

    await user.click(refreshButton)
    expect(refreshButton).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      resolve({ error: { status: 503 } })
      await request
    })

    expect(refreshButton).toBeEnabled()
    expect(refreshButton).not.toHaveAttribute('aria-busy', 'true')
    await user.click(refreshButton)
    expect(mocks.refetch).toHaveBeenCalledTimes(2)
    expect(refreshButton).toBeEnabled()
  })

  it('shows active rooms before completed rooms and filters without changing the source list', async () => {
    const { user } = setup()
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/games/lottery/ready',
      '/games/lottery/drawing',
      '/games/lottery/finished',
    ])
    await user.click(screen.getByRole('button', { name: '준비·진행 중 2' }))
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: /어제의 추첨/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '완료 1' }))
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /어제의 추첨/ })).toHaveTextContent('결과 보기')
    expect(rooms[0].id).toBe('finished')
  })

  it('creates a room with the trimmed title and opens it', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('방 이름'))
    await user.type(screen.getByLabelText('방 이름'), '  점심 뽑기  ')
    await user.click(screen.getByRole('button', { name: '방 만들기' }))
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '점심 뽑기',
        winnerCount: 1,
        participants: expect.any(Array),
      }),
    )
    expect(mocks.create.mock.calls[0][0].participants).toHaveLength(13)
    expect(mocks.navigate).toHaveBeenCalledWith('/games/lottery/new-room')
  })

  it('rejects a blank title without creating a room', async () => {
    const { user } = setup()
    await user.clear(screen.getByLabelText('방 이름'))
    await user.click(screen.getByRole('button', { name: '방 만들기' }))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(screen.getByText('방 이름을 1~60자로 입력해 주세요.')).toBeInTheDocument()
  })

  it('distinguishes a filtered empty result from a failed request', async () => {
    mocks.list.mockReturnValue({
      data: rooms.filter((room) => room.status === 'FINISHED'),
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: mocks.refetch,
    })
    const { user, rerender } = setup()
    await user.click(screen.getByRole('button', { name: '준비·진행 중 0' }))
    expect(screen.getByText('준비·진행 중인 추첨이 없어요.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    mocks.list.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch })
    rerender(
      <MemoryRouter>
        <LotteryLobby />
      </MemoryRouter>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('추첨방을 불러오지 못했습니다.')
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('keeps the list available and explains interrupted live updates', () => {
    mocks.list.mockReturnValue({
      data: rooms,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
      connectionStatus: 'reconnecting',
    })
    const { rerender } = setup()
    expect(screen.getByRole('status')).toHaveTextContent('실시간 업데이트에 다시 연결 중이에요.')
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '추첨방 목록 새로고침' })).toBeEnabled()

    mocks.list.mockReturnValue({
      data: rooms,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
      connectionStatus: 'authError',
    })
    rerender(
      <MemoryRouter>
        <LotteryLobby />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('새로고침을 눌러 다시 연결해 주세요.')
  })
})
