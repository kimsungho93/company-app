import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import styles from './Button.module.scss'

describe('Button', () => {
  it('일반 버튼은 제출하지 않고 명시적인 제출 버튼만 폼을 제출한다', () => {
    const submit = vi.fn((event) => event.preventDefault())
    render(
      <form onSubmit={submit}>
        <Button>취소</Button>
        <Button type="submit">저장</Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('외부 클래스가 기본 스타일을 보존하고 loading 중 클릭을 막는다', () => {
    const click = vi.fn()
    render(
      <Button loading className="custom" onClick={click}>
        저장
      </Button>,
    )
    const button = screen.getByRole('button', { name: '저장' })
    expect(button).toHaveClass(styles.button, 'custom')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
  })
})
