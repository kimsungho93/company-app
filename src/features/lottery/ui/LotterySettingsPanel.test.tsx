import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { LotteryRoomSnapshot } from '../api/types'
import { LotterySettingsPanel } from './LotterySettingsPanel'

const room: LotteryRoomSnapshot = {
  id: 'room', title: '점심 추첨', hostId: 1, hostName: '선도우', participants: ['선도우', '육이슬'],
  winnerCount: 1, status: 'READY', winners: [], members: [], version: 1,
  serverTime: '2026-09-14T00:00:00Z', nextDrawAt: null, drawId: 1,
}

const setup = (overrides: Partial<ComponentProps<typeof LotterySettingsPanel>> = {}) => {
  const props = { room, isHost: true, busy: false, connected: true, onSave: vi.fn().mockResolvedValue(true), onStart: vi.fn().mockResolvedValue(true), ...overrides }
  const view = render(<LotterySettingsPanel {...props} />)
  const user = userEvent.setup()
  const openRoster = () => user.click(view.container.querySelector('summary')!)
  return { ...view, props, user, openRoster }
}

describe('LotterySettingsPanel', () => {
  it('starts with a collapsed roster and one clear primary action', () => {
    const { container } = setup()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(container.querySelector('summary')).toHaveTextContent('추첨 명단 · 2명')
    expect(screen.getByRole('button', { name: '1명 추첨 시작' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '명단만 저장' })).not.toBeInTheDocument()
  })

  it('adds trimmed names and hands the changed draft to the combined start action', async () => {
    const { user, props, openRoster } = setup()
    await openRoster()
    await user.type(screen.getByLabelText('이름 추가'), '  김성호  ')
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(within(screen.getByRole('list', { name: '추첨 대상 명단' })).getByText('김성호')).toBeInTheDocument()
    expect(screen.getByLabelText('이름 추가')).toHaveValue('')
    const start = screen.getByRole('button', { name: '저장하고 1명 추첨' })
    expect(start).toBeEnabled()
    await user.click(start)
    expect(props.onStart).toHaveBeenCalledWith({ participants: ['선도우', '육이슬', '김성호'], winnerCount: 1 })
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('offers a secondary save-only action without starting', async () => {
    const { user, props } = setup()
    await user.click(screen.getByRole('button', { name: '당첨 인원 늘리기' }))
    await user.click(screen.getByRole('button', { name: '명단만 저장' }))
    expect(props.onSave).toHaveBeenCalledWith({ participants: room.participants, winnerCount: 2 })
    expect(props.onStart).not.toHaveBeenCalled()
  })

  it('does not silently drop a typed name when the roster is collapsed before starting', async () => {
    const { user, props, openRoster, container } = setup()
    await openRoster()
    await user.type(screen.getByLabelText('이름 추가'), '김성호')
    await openRoster()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: '1명 추첨 시작' }))
    expect(screen.getByRole('alert')).toHaveTextContent('입력한 이름을 먼저 추가')
    expect(container.querySelector('details')).toHaveAttribute('open')
    expect(screen.getByLabelText('이름 추가')).toHaveFocus()
    expect(props.onStart).not.toHaveBeenCalled()
  })

  it('rejects duplicates after trimming and keeps the original list intact', async () => {
    const { user, props, openRoster } = setup()
    await openRoster()
    await user.type(screen.getByLabelText('이름 추가'), ' 선도우 ')
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(screen.getByRole('alert')).toHaveTextContent('이미 명단에 있는 이름')
    expect(within(screen.getByRole('list', { name: '추첨 대상 명단' })).getAllByRole('listitem')).toHaveLength(2)
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('removes names but prevents saving or starting an empty draft', async () => {
    const { user, props, openRoster } = setup({ room: { ...room, participants: ['선도우'] } })
    await openRoster()
    await user.click(screen.getByRole('button', { name: '선도우 명단에서 빼기' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1~50명')
    expect(screen.getByRole('button', { name: '명단만 저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '저장하고 1명 추첨' })).toBeDisabled()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('automatically reduces the winner count when a participant is removed', async () => {
    const { user, openRoster } = setup({ room: { ...room, winnerCount: 2 } })
    await openRoster()
    await user.click(screen.getByRole('button', { name: '육이슬 명단에서 빼기' }))
    expect(screen.getByLabelText('당첨 인원')).toHaveValue(1)
    expect(screen.getByRole('button', { name: '저장하고 1명 추첨' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the stepper between one and the participant count', async () => {
    const { user } = setup()
    expect(screen.getByRole('button', { name: '당첨 인원 줄이기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '당첨 인원 늘리기' }))
    expect(screen.getByLabelText('당첨 인원')).toHaveValue(2)
    expect(screen.getByRole('button', { name: '당첨 인원 늘리기' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '당첨 인원 줄이기' }))
    expect(screen.getByLabelText('당첨 인원')).toHaveValue(1)
    expect(screen.getByRole('button', { name: '당첨 인원 줄이기' })).toBeDisabled()
  })

  it('limits names to 30 characters and disables adding at 50 participants', async () => {
    const { openRoster } = setup({ room: { ...room, participants: Array.from({ length: 50 }, (_, index) => '참가자' + index) } })
    await openRoster()
    expect(screen.getByLabelText('이름 추가')).toHaveAttribute('maxlength', '30')
    expect(screen.getByLabelText('이름 추가')).toBeDisabled()
    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
  })

  it.each(['', '0', '3', '1.5'])('blocks an invalid manually entered winner count %s', (value) => {
    setup()
    fireEvent.change(screen.getByLabelText('당첨 인원'), { target: { value } })
    expect(screen.getByRole('alert')).toHaveTextContent('당첨 인원')
    expect(screen.getByRole('button', { name: '명단만 저장' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /저장하고 .*명 추첨/ })).toBeDisabled()
  })

  it.each([
    { isHost: false, room },
    { isHost: true, room: { ...room, status: 'FINISHED' as const } },
    { isHost: true, room: { ...room, status: 'DRAWING' as const } },
  ])('shows a collapsed roster and plain count to viewers outside host preparation', async (overrides) => {
    const { container, openRoster } = setup(overrides)
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('이름 추가')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /추첨 시작/ })).not.toBeInTheDocument()
    expect(screen.getByText('당첨 인원')).toBeInTheDocument()
    expect(screen.getByText('1명')).toBeInTheDocument()
    await openRoster()
    expect(screen.getByRole('list', { name: '추첨 대상 명단' })).toHaveTextContent('선도우')
    expect(screen.queryByRole('button', { name: /명단에서 빼기/ })).not.toBeInTheDocument()
  })

  it.each([{ busy: true }, { connected: false }])('blocks edits and starting while unavailable', async (overrides) => {
    const { openRoster } = setup(overrides)
    await openRoster()
    expect(screen.getByLabelText('이름 추가')).toBeDisabled()
    expect(screen.getByLabelText('당첨 인원')).toBeDisabled()
    expect(screen.getByRole('button', { name: '선도우 명단에서 빼기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /추첨 시작/ })).toBeDisabled()
  })

  it('starts an unchanged draft without sending redundant settings', async () => {
    const { user, props } = setup()
    await user.click(screen.getByRole('button', { name: '1명 추첨 시작' }))
    expect(props.onStart).toHaveBeenCalledExactlyOnceWith()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  it('prevents repeated submissions while the combined action is pending', async () => {
    const onStart = vi.fn(() => new Promise<boolean>(() => {}))
    const { user } = setup({ onStart })
    await user.click(screen.getByRole('button', { name: '당첨 인원 늘리기' }))
    const button = screen.getByRole('button', { name: '저장하고 2명 추첨' })
    await user.dblClick(button)
    expect(onStart).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    expect(screen.getByRole('button', { name: '명단만 저장' })).toBeDisabled()
  })

  it('keeps the changed roster available when the combined operation fails', async () => {
    const onStart = vi.fn().mockResolvedValue(false)
    const { user } = setup({ onStart })
    await user.click(screen.getByRole('button', { name: '당첨 인원 늘리기' }))
    await user.click(screen.getByRole('button', { name: '저장하고 2명 추첨' }))
    expect(screen.getByLabelText('당첨 인원')).toHaveValue(2)
    expect(screen.getByRole('button', { name: '저장하고 2명 추첨' })).toBeEnabled()
  })
})
