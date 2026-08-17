import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { AdminLink } from './AdminLink'

const meWith = (role: string) => ({
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role,
  status: 'APPROVED',
})

describe('AdminLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('관리자에게는 승인 관리 링크를 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(meWith('ADMIN'))))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AdminLink />, { wrapper })

    await waitFor(() =>
      expect(screen.getByRole('link', { name: '승인 관리' })).toHaveAttribute(
        'href',
        '/admin/users',
      ),
    )
  })

  it('일반 사용자에게는 아무것도 보여주지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(meWith('USER'))))
    const { wrapper } = createTestWrapper({ withRouter: true })

    render(<AdminLink />, { wrapper })

    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument())
    // 빈 랜드마크가 남으면 스크린리더가 빈 '관리' 영역을 읽는다
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
