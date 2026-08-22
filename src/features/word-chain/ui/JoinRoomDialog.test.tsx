import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import type { RoomSummary } from '../api/types'
import { JoinRoomDialog } from './JoinRoomDialog'

const ROOM: RoomSummary = {
  id: 1,
  name: '점심내기 한판',
  hostName: '김성호',
  playerCount: 3,
  capacity: 10,
  locked: true,
  status: 'WAITING',
}

const ROOM_B: RoomSummary = {
  id: 2,
  name: '개발팀 모여라',
  hostName: '박철수',
  playerCount: 7,
  capacity: 10,
  locked: true,
  status: 'WAITING',
}

const setup = () => {
  const onClose = vi.fn()
  const onJoined = vi.fn()
  const { wrapper } = createTestWrapper()
  return {
    user: userEvent.setup(),
    onClose,
    onJoined,
    ...render(<JoinRoomDialog room={ROOM} onClose={onClose} onJoined={onJoined} />, { wrapper }),
  }
}

describe('JoinRoomDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('접근 가능한 이름을 가진다', () => {
    vi.stubGlobal('fetch', vi.fn())
    setup()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('점심내기 한판')
  })

  it('어느 방에 들어가는지 보여준다', () => {
    vi.stubGlobal('fetch', vi.fn())
    setup()

    expect(screen.getByRole('heading', { name: '점심내기 한판' })).toBeInTheDocument()
  })

  it('비밀번호를 담아 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ROOM))
    vi.stubGlobal('fetch', fetchMock)
    const { user, onJoined } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(ROOM))
    const request = fetchMock.mock.calls[0][0] as Request
    expect(request.url).toContain('/rooms/1/join')
    expect(JSON.parse(await request.text())).toEqual({ password: '1234' })
  })

  it('비밀번호가 틀리면 서버 문구를 띄우고 창이 남는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'WRONG_ROOM_PASSWORD', message: '비밀번호가 올바르지 않습니다.' }, 403),
      ),
    )
    const { user, onJoined } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '9999')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('비밀번호가 올바르지 않습니다.'),
    )
    expect(onJoined).not.toHaveBeenCalled()
  })

  it('정원이 찼으면 서버 문구를 띄운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse({ code: 'ROOM_FULL', message: '방이 가득 찼습니다.' }, 409)),
    )
    const { user } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '들어가기' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('방이 가득 찼습니다.'))
  })

  it('다른 방으로 바꾸면 비밀번호와 오류가 비워진다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'WRONG_ROOM_PASSWORD', message: '비밀번호가 올바르지 않습니다.' }, 403),
      ),
    )
    const { user, onClose, onJoined, rerender } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '9999')
    await user.click(screen.getByRole('button', { name: '들어가기' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    rerender(<JoinRoomDialog room={ROOM_B} onClose={onClose} onJoined={onJoined} />)

    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('제출을 연달아 두 번 해도 요청은 한 번만 나간다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(ROOM))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.type(screen.getByLabelText('비밀번호'), '1234')
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})
