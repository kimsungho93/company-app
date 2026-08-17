import { render, screen, waitFor } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { RequireAdmin } from './RequireAdmin'

const meWith = (role: string) => ({
  id: 1,
  email: 'tiger@ibslab.com',
  name: '김성호',
  role,
  status: 'APPROVED',
})

const renderAt = (route: string) => {
  const { wrapper } = createTestWrapper({ withRouter: true, route })
  return render(
    <Routes>
      <Route path="/" element={<p>홈</p>} />
      <Route element={<RequireAdmin />}>
        <Route path="/admin/users" element={<p>승인 관리</p>} />
      </Route>
    </Routes>,
    { wrapper },
  )
}

describe('RequireAdmin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // role 을 모르는 상태에서 판단하면 관리자인데도 홈으로 튕긴다.
  // RequireAuth 가 status === 'unknown' 일 때 아무것도 안 그리는 것과 같은 이유다.
  it('me 로딩 중에는 아무것도 렌더하지 않는다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderAt('/admin/users')

    expect(screen.queryByText('승인 관리')).not.toBeInTheDocument()
    expect(screen.queryByText('홈')).not.toBeInTheDocument()
  })

  it('관리자는 통과시킨다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(meWith('ADMIN'))))
    renderAt('/admin/users')

    await waitFor(() => expect(screen.getByText('승인 관리')).toBeInTheDocument())
  })

  it('일반 사용자는 홈으로 보낸다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(meWith('USER'))))
    renderAt('/admin/users')

    await waitFor(() => expect(screen.getByText('홈')).toBeInTheDocument())
  })
})
