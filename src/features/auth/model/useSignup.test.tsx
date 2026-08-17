import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWrapper, emptyResponse, jsonResponse } from '@/test/storeWrapper'
import { useSignup } from './useSignup'

const VALID = { email: 'tiger@ibslab.com', name: '김성호', password: 'password1234' }

describe('useSignup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 백엔드는 201 에 본문을 주지 않는다. 본문을 기대하고 파싱하면 여기서 깨진다.
  it('본문 없는 201 을 성공으로 처리한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse(201)))
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useSignup(), { wrapper })

    let ok = false
    await act(async () => {
      ok = await result.current.submit(VALID)
    })

    expect(ok).toBe(true)
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.formError).toBeNull()
    expect(result.current.fieldError).toBeNull()
  })

  it('이메일 중복은 폼 상단이 아니라 이메일 필드로 보낸다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'EMAIL_ALREADY_EXISTS', message: '이미 가입된 이메일입니다.' }, 409),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useSignup(), { wrapper })

    let ok = true
    await act(async () => {
      ok = await result.current.submit(VALID)
    })

    expect(ok).toBe(false)
    expect(result.current.fieldError).toEqual({
      field: 'email',
      message: '이미 가입된 이메일입니다.',
    })
    expect(result.current.formError).toBeNull()
  })

  // 백엔드가 모든 검증 실패를 이 코드 하나로 뭉쳐 보내므로 필드를 특정할 수 없다.
  it('INVALID_INPUT 은 폼 상단에 띄운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          { code: 'INVALID_INPUT', message: '이름은 2자 이상 10자 이하여야 합니다.' },
          400,
        ),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useSignup(), { wrapper })

    await act(async () => {
      await result.current.submit(VALID)
    })

    expect(result.current.fieldError).toBeNull()
    expect(result.current.formError).toBe('이름은 2자 이상 10자 이하여야 합니다.')
  })

  it('네트워크 실패를 알린다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useSignup(), { wrapper })

    await act(async () => {
      await result.current.submit(VALID)
    })

    expect(result.current.formError).toBe('네트워크에 연결할 수 없습니다.')
  })

  it('clearError 로 두 종류의 오류를 모두 지운다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ code: 'EMAIL_ALREADY_EXISTS', message: '이미 가입된 이메일입니다.' }, 409),
      ),
    )
    const { wrapper } = createTestWrapper()
    const { result } = renderHook(() => useSignup(), { wrapper })

    await act(async () => {
      await result.current.submit(VALID)
    })
    expect(result.current.fieldError).not.toBeNull()

    act(() => result.current.clearError())
    expect(result.current.fieldError).toBeNull()
    expect(result.current.formError).toBeNull()
  })
})
