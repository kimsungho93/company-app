import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { roomApi } from '../api/roomApi'
import type { RoomSummary } from '../api/types'
import { RoomList } from './RoomList'

const ROOMS: RoomSummary[] = [
  {
    id: 1,
    name: '점심내기 한판',
    hostName: '김성호',
    playerCount: 3,
    capacity: 10,
    locked: true,
    status: 'WAITING',
  },
  {
    id: 2,
    name: '개발팀 모여라',
    hostName: '박철수',
    playerCount: 7,
    capacity: 10,
    locked: false,
    status: 'PLAYING',
  },
  {
    id: 3,
    name: '가득 찬 방',
    hostName: '이영희',
    playerCount: 10,
    capacity: 10,
    locked: false,
    status: 'WAITING',
  },
]

const setup = (onJoin = vi.fn()) => {
  const { store, wrapper } = createTestWrapper()
  return {
    user: userEvent.setup(),
    onJoin,
    store,
    ...render(<RoomList onJoin={onJoin} />, { wrapper }),
  }
}

describe('RoomList', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('방 이름과 인원을 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const card = await screen.findByRole('listitem', { name: /점심내기 한판/ })
    expect(within(card).getByText('3/10')).toBeInTheDocument()
  })

  it('비밀번호가 걸린 방을 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const locked = await screen.findByRole('listitem', { name: /점심내기 한판/ })
    const open = screen.getByRole('listitem', { name: /개발팀 모여라/ })

    expect(within(locked).getByText('비밀번호')).toBeInTheDocument()
    expect(within(open).queryByText('비밀번호')).not.toBeInTheDocument()
  })

  it('게임 중인 방을 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    setup()

    const playing = await screen.findByRole('listitem', { name: /개발팀 모여라/ })
    expect(within(playing).getByText('게임중')).toBeInTheDocument()
  })

  it('방이 없으면 안내를 띄운다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))
    setup()

    expect(await screen.findByText('아직 만들어진 방이 없습니다.')).toBeInTheDocument()
  })

  it('조회가 실패하면 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'INTERNAL_ERROR', message: '서버에 문제가 발생했습니다.' }, 500),
      ),
    )
    setup()

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('서버에 문제가 발생했습니다.'),
    )
  })

  it('방을 누르면 onJoin 을 부른다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    const { user, onJoin } = setup()

    await user.click(await screen.findByRole('button', { name: /점심내기 한판/ }))

    expect(onJoin).toHaveBeenCalledWith(ROOMS[0])
  })

  it('정원이 찬 방은 입장할 수 없다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ROOMS)))
    const { user, onJoin } = setup()

    const button = await screen.findByRole('button', { name: /가득 찬 방/ })
    expect(button).toBeDisabled()

    await user.click(button)

    expect(onJoin).not.toHaveBeenCalled()
  })

  it('새로고침이 실패해도 이미 불러온 목록은 남고 오류가 위에 뜬다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(ROOMS))
        .mockResolvedValueOnce(
          jsonResponse({ code: 'INTERNAL_ERROR', message: '서버에 문제가 발생했습니다.' }, 500),
        ),
    )
    const { store } = setup()

    await screen.findByRole('listitem', { name: /점심내기 한판/ })

    store.dispatch(roomApi.util.invalidateTags(['Rooms']))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('서버에 문제가 발생했습니다.'),
    )
    expect(screen.getByRole('listitem', { name: /점심내기 한판/ })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /개발팀 모여라/ })).toBeInTheDocument()
  })
})
