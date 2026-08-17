import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { AppHeader } from './AppHeader'

const ME = {
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role: 'USER',
  status: 'APPROVED',
}

describe('AppHeader', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('me 가 오면 이름을 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ME)))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AppHeader />, { wrapper })

    await waitFor(() => expect(screen.getByText('김성호')).toBeInTheDocument())
  })

  // 이름이 툭 나타나면 옆 요소들이 밀린다
  it('me 가 오기 전에도 이름 자리를 차지한다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AppHeader />, { wrapper })

    expect(screen.getByTestId('user-name')).toBeInTheDocument()
    expect(screen.getByTestId('user-name')).toHaveTextContent('')
  })

  it('로고가 홈으로 간다', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ME)))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AppHeader />, { wrapper })

    expect(screen.getByRole('link', { name: '아이비에스 홈' })).toHaveAttribute('href', '/')
  })

  it('로그아웃 버튼이 있다', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(ME)))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AppHeader />, { wrapper })

    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })
})
