import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '@/shared/api'
import { createTestWrapper, jsonResponse } from '@/test/storeWrapper'
import { useLogin } from './useLogin'

const CREDENTIALS = { email: 'tiger@ibslab.com', password: 'password1234' }

describe('useLogin', () => {
  beforeEach(() => {
    tokenStore.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('성공하면 status 가 success 가 되고 토큰을 보관한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ accessToken: 'tok', expiresIn: 1800 })),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    let ok = false
    await act(async () => {
      ok = await result.current.submit(CREDENTIALS)
    })

    expect(ok).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.formError).toBeNull()
    expect(tokenStore.get()).toBe('tok')
  })

  it('401 이면 어느 쪽이 틀렸는지 알려주지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'INVALID_CREDENTIALS', message: '비밀번호가 틀렸습니다' }, 401),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    let ok = true
    await act(async () => {
      ok = await result.current.submit(CREDENTIALS)
    })

    expect(ok).toBe(false)
    // 서버가 보낸 구체적인 문구를 그대로 노출하지 않는다
    expect(result.current.formError).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  // 로그인 401 은 자격 증명이 틀린 것이지 세션이 만료된 게 아니다.
  // 다른 계정으로 로그인하려다 실패했다고 기존 세션을 끊지 않는다.
  it('로그인 실패가 기존 세션을 건드리지 않는다', async () => {
    tokenStore.set('existing')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 401))
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(async () => {
      await result.current.submit(CREDENTIALS)
    })

    expect(tokenStore.get()).toBe('existing')
    // 재발급을 시도하지 않는다
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('네트워크 실패를 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(async () => {
      await result.current.submit(CREDENTIALS)
    })

    expect(result.current.formError).toBe('네트워크에 연결할 수 없습니다.')
  })

  // 403 은 자격 증명이 아니라 승인 상태의 문제다. 401 문구로 덮으면
  // 사용자가 맞는 비밀번호를 계속 다시 친다.
  it('승인 대기 중이면 그 사실을 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'APPROVAL_PENDING', message: '관리자 승인 대기 중입니다.' }, 403),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(async () => {
      await result.current.submit(CREDENTIALS)
    })

    expect(result.current.formError).toBe('관리자 승인 대기 중입니다. 승인 후 이용할 수 있습니다.')
  })

  it('거절된 계정이면 그 사실을 알린다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'SIGNUP_REJECTED', message: '가입이 거절되었습니다.' }, 403),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(async () => {
      await result.current.submit(CREDENTIALS)
    })

    expect(result.current.formError).toBe('가입이 거절되었습니다. 관리자에게 문의해 주세요.')
  })

  it('clearError 로 오류를 지운다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(async () => {
      await result.current.submit(CREDENTIALS)
    })
    expect(result.current.formError).not.toBeNull()

    act(() => result.current.clearError())
    expect(result.current.formError).toBeNull()
  })
})
