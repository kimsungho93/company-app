import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { CreateRoomDialog } from './CreateRoomDialog'

const CREATED = {
  id: 9,
  name: '점심내기 한판',
  hostName: '김성호',
  playerCount: 1,
  capacity: 10,
  locked: false,
  status: 'WAITING',
}

const setup = () => {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  const { wrapper } = createTestWrapper()
  return {
    user: userEvent.setup(),
    onClose,
    onCreated,
    ...render(<CreateRoomDialog open onClose={onClose} onCreated={onCreated} />, { wrapper }),
  }
}

describe('CreateRoomDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('접근 가능한 이름을 가진다', () => {
    setup()

    expect(screen.getByRole('dialog')).toHaveAccessibleName('방 만들기')
  })

  it('이름이 비면 만들지 못한다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText('방 이름을 입력해 주세요.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('30자부터 막는다', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { user } = setup()

    await user.type(screen.getByLabelText('방 이름'), '가'.repeat(30))
    await user.click(screen.getByRole('button', { name: '만들기' }))

    expect(screen.getByText('방 이름은 29자까지 입력할 수 있습니다.')).toBeInTheDocument()
  })

  it('비밀번호 없이 만들면 name 만 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { user, onCreated } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED))
    const body = JSON.parse(await (fetchMock.mock.calls[0][0] as Request).text())
    expect(body).toEqual({ name: '점심내기 한판' })
  })

  it('비밀번호를 넣으면 함께 보낸다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.type(screen.getByLabelText('비밀번호'), '1234')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(await (fetchMock.mock.calls[0][0] as Request).text())
    expect(body).toEqual({ name: '점심내기 한판', password: '1234' })
  })

  it('서버가 거절하면 그 문구를 띄운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ code: 'INVALID_INPUT', message: '방 이름을 확인해 주세요.' }, 400),
        ),
    )
    const { user, onCreated } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('방 이름을 확인해 주세요.'),
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('취소하면 onClose 가 불리고, 다시 열었을 때 입력과 오류가 비어 있다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ code: 'INVALID_INPUT', message: '방 이름을 확인해 주세요.' }, 400),
        ),
    )
    const { user, onClose, onCreated, rerender } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    await user.click(screen.getByRole('button', { name: '만들기' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<CreateRoomDialog open={false} onClose={onClose} onCreated={onCreated} />)
    rerender(<CreateRoomDialog open onClose={onClose} onCreated={onCreated} />)

    expect(screen.getByLabelText('방 이름')).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('제출을 연달아 두 번 해도 요청은 한 번만 나간다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = setup()

    await user.type(screen.getByLabelText('방 이름'), '점심내기 한판')
    const form = document.querySelector('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })
})
