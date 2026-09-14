import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LotteryRoomPage } from './LotteryPages'

const mocks = vi.hoisted(() => ({ me: vi.fn(), room: vi.fn() }))

vi.mock('@/features/auth', () => ({ useMeQuery: () => mocks.me() }))
vi.mock('@/features/lottery', () => ({
  LotteryLobby: () => null,
  LotteryRoom: (props: unknown) => { mocks.room(props); return <p>추첨방 내용</p> },
}))

const page = () => <MemoryRouter initialEntries={['/games/lottery/room-one']}>
  <Routes><Route path="/games/lottery/:roomId" element={<LotteryRoomPage />} /></Routes>
</MemoryRouter>

describe('LotteryRoomPage identity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('waits for identity before joining instead of briefly treating the host as a spectator', () => {
    mocks.me.mockReturnValue({ isLoading: true, isFetching: true })
    render(page())
    expect(screen.getByRole('status')).toHaveTextContent('내 정보를 확인하는 중')
    expect(mocks.room).not.toHaveBeenCalled()
  })

  it('offers retry after identity failure and enters with the recovered user id', async () => {
    const refetch = vi.fn()
    mocks.me.mockReturnValue({ isLoading: false, isFetching: false, isError: true, refetch })
    const { rerender } = render(page())
    expect(screen.getByRole('alert')).toHaveTextContent('내 정보를 불러오지 못했습니다')
    expect(mocks.room).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: '내 정보 다시 조회' }))
    expect(refetch).toHaveBeenCalledOnce()
    mocks.me.mockReturnValue({ data: { id: 42 }, isLoading: false, isFetching: false })
    rerender(page())
    expect(screen.getByText('추첨방 내용')).toBeInTheDocument()
    expect(mocks.room).toHaveBeenLastCalledWith({ roomId: 'room-one', myUserId: 42 })
  })

  it('keeps an established room mounted during a background identity refresh', () => {
    mocks.me.mockReturnValue({ data: { id: 42 }, isLoading: false, isFetching: true })
    render(page())
    expect(screen.getByText('추첨방 내용')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
