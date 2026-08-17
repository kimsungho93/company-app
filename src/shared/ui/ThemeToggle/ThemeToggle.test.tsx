import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { themeStore } from '@/shared/theme'
import { ThemeToggle } from './ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    localStorage.clear()
    themeStore.set('system')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 아이콘만으로는 무엇인지 알 수 없다
  it('현재 테마가 아니라 바뀔 테마를 라벨로 알린다', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument()
  })

  it('누르면 반대 테마로 명시 전환한다', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByRole('button'))

    expect(themeStore.get()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument()
  })
})
