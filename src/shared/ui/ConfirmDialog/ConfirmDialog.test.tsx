import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

const setup = (overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const view = render(
    <ConfirmDialog
      open
      title="거절하시겠습니까?"
      description="되돌리려면 거절됨 탭에서 다시 승인해야 합니다."
      confirmLabel="거절"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onConfirm, onCancel, view }
}

describe('ConfirmDialog', () => {
  it('open 이면 열리고 제목과 설명을 보여준다', () => {
    setup()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('open')
    expect(screen.getByRole('heading', { name: '거절하시겠습니까?' })).toBeInTheDocument()
    expect(screen.getByText(/거절됨 탭에서 다시 승인/)).toBeInTheDocument()
  })

  it('open 이 아니면 닫혀 있다', () => {
    setup({ open: false })

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
  })

  // 제목과 설명이 연결되지 않으면 스크린리더가 버튼 이름만 읽고 만다
  it('제목과 설명이 dialog 에 연결된다', () => {
    setup()
    const dialog = screen.getByRole('dialog')

    expect(dialog).toHaveAccessibleName('거절하시겠습니까?')
    expect(dialog).toHaveAccessibleDescription('되돌리려면 거절됨 탭에서 다시 승인해야 합니다.')
  })

  it('확인을 누르면 onConfirm 이 불린다', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()

    await user.click(screen.getByRole('button', { name: '거절' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('취소를 누르면 onCancel 이 불린다', async () => {
    const user = userEvent.setup()
    const { onConfirm, onCancel } = setup()

    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // 요청이 나가는 중에 한 번 더 누르면 같은 동작이 두 번 나간다
  it('busy 면 두 버튼 모두 잠긴다', () => {
    setup({ busy: true })

    expect(screen.getByRole('button', { name: '거절' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  })
})
