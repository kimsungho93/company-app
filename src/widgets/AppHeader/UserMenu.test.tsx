import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, emptyResponse, jsonResponse } from '@/test/storeWrapper'
import { UserMenu } from './UserMenu'

const ME = { id: 1, email: 'tiger@ibslab.com', name: '김성호', role: 'USER', status: 'APPROVED' }

const stubFetch = () => {
  const fetchMock = vi.fn((input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.includes('/users/me')) return Promise.resolve(jsonResponse(ME))
    return Promise.resolve(emptyResponse(204))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const calledLogout = (mock: ReturnType<typeof stubFetch>) =>
  mock.mock.calls.some(([sent]) => String((sent as Request)?.url ?? sent).includes('/auth/logout'))

const setup = () => {
  const fetchMock = stubFetch()
  const { wrapper } = createTestWrapper({ withRouter: true })
  return { fetchMock, user: userEvent.setup(), ...render(<UserMenu />, { wrapper }) }
}

const trigger = () => screen.getByRole('button', { name: '로그아웃' })

describe('UserMenu', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('로그아웃을 누르면 바로 나가지 않고 확인을 묻는다', async () => {
    const { user, fetchMock } = setup()

    await user.click(trigger())

    expect(screen.getByRole('dialog')).toHaveAccessibleName('로그아웃하시겠습니까?')
    expect(calledLogout(fetchMock)).toBe(false)
  })

  it('확인하면 로그아웃한다', async () => {
    const { user, fetchMock } = setup()
    await user.click(trigger())

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '로그아웃' }))

    await waitFor(() => expect(calledLogout(fetchMock)).toBe(true))
  })

  it('취소하면 그대로 있는다', async () => {
    const { user, fetchMock } = setup()
    await user.click(trigger())

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }))

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open')
    expect(calledLogout(fetchMock)).toBe(false)
  })
})
