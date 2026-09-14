import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('닫기 금지 상태에서는 Escape와 배경 클릭을 무시한다', () => {
    const dismiss = vi.fn()
    const { rerender } = render(
      <Dialog open labelledBy="title" dismissible={false} onDismiss={dismiss}>
        <h2 id="title">저장 중</h2>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    fireEvent.click(dialog)
    expect(dismiss).not.toHaveBeenCalled()
    expect(dialog).toHaveAttribute('open')

    rerender(
      <Dialog open labelledBy="title" onDismiss={dismiss}>
        <h2 id="title">저장 완료</h2>
      </Dialog>,
    )
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('중첩 모달의 Escape는 자식만 닫고 열었던 버튼으로 돌아온다', async () => {
    const user = userEvent.setup()
    const Example = () => {
      const [parent, setParent] = useState(false)
      const [child, setChild] = useState(false)
      return (
        <>
          <button onClick={() => setParent(true)}>부모 열기</button>
          <Dialog open={parent} labelledBy="parent-title" onDismiss={() => setParent(false)}>
            <h2 id="parent-title">부모</h2>
            <button onClick={() => setChild(true)}>자식 열기</button>
            <Dialog open={child} labelledBy="child-title" onDismiss={() => setChild(false)}>
              <h2 id="child-title">자식</h2>
            </Dialog>
          </Dialog>
        </>
      )
    }
    render(<Example />)
    const parentTrigger = screen.getByRole('button', { name: '부모 열기' })
    await user.click(parentTrigger)
    const childTrigger = screen.getByRole('button', { name: '자식 열기' })
    await user.click(childTrigger)
    fireEvent(screen.getByRole('dialog', { name: '자식' }), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(screen.getByRole('dialog', { name: '부모' })).toHaveAttribute('open')
    expect(screen.queryByRole('dialog', { name: '자식' })).not.toBeInTheDocument()
    expect(childTrigger).toHaveFocus()
    fireEvent(screen.getByRole('dialog', { name: '부모' }), new Event('cancel', { bubbles: true, cancelable: true }))
    expect(parentTrigger).toHaveFocus()
    await user.click(parentTrigger)
    expect(screen.getByRole('dialog', { name: '부모' })).toHaveAttribute('open')
  })
})
