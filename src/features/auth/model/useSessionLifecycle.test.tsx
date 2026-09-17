import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sessionStore } from '@/shared/api'
import { useSessionLifecycle } from './useSessionLifecycle'

const calls = vi.hoisted(() => ({ check: vi.fn(), activity: vi.fn() }))
vi.mock('@/shared/api', async (original) => ({
  ...(await original<object>()),
  checkSession: () => calls.check(),
  reportActivity: () => calls.activity(),
}))

const metadata = (idle = 90_000, absolute = 8 * 60 * 60_000) => ({
  sessionId: 'session-a',
  serverTime: new Date().toISOString(),
  idleExpiresAt: new Date(Date.now() + idle).toISOString(),
  absoluteExpiresAt: new Date(Date.now() + absolute).toISOString(),
})

describe('session lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    localStorage.clear()
    sessionStore.beginLogin()
    sessionStore.accept(metadata(), true, false)
    calls.check.mockReset().mockResolvedValue('success')
    calls.activity.mockReset().mockResolvedValue('success')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('warns one minute before idle expiry', async () => {
    const { result } = renderHook(() => useSessionLifecycle())
    expect(result.current.warning).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.warning).toBe(true)
    expect(result.current.secondsRemaining).toBe(60)
    expect(calls.activity).not.toHaveBeenCalled()
  })

  it('focus, reconnect and synthetic events never extend the session', async () => {
    renderHook(() => useSessionLifecycle())
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(calls.check).toHaveBeenCalled()
    expect(calls.activity).not.toHaveBeenCalled()
  })

  it('continues only through the explicit activity request', async () => {
    sessionStore.accept(metadata(50_000), true, false)
    calls.activity.mockImplementation(async () => {
      sessionStore.accept(metadata(30 * 60_000))
      return 'success'
    })
    const { result } = renderHook(() => useSessionLifecycle())
    expect(result.current.warning).toBe(true)
    await act(async () => {
      await result.current.continueSession()
    })
    expect(calls.activity).toHaveBeenCalledOnce()
    expect(result.current.warning).toBe(false)
  })

  it('checks a stale deadline and keeps a session extended by another tab', async () => {
    sessionStore.accept(metadata(1_000), true, false)
    calls.check.mockImplementation(async () => {
      sessionStore.accept(metadata(30 * 60_000))
      return 'success'
    })
    const { result } = renderHook(() => useSessionLifecycle())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(calls.check).toHaveBeenCalledOnce()
    expect(sessionStore.get().ended).toBe(false)
    expect(result.current.expired).toBe(false)
    expect(result.current.warning).toBe(false)
  })

  it('locks the expired view on a network failure without ending the session', async () => {
    sessionStore.accept(metadata(1_000), true, false)
    calls.check.mockResolvedValue('retryable')
    const { result } = renderHook(() => useSessionLifecycle())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(result.current.expired).toBe(true)
    expect(result.current.failed).toBe(true)
    expect(sessionStore.get().ended).toBe(false)
  })

  it('uses absolute expiry when it comes before idle expiry', () => {
    sessionStore.accept(metadata(30 * 60_000, 45_000), true, false)
    const { result } = renderHook(() => useSessionLifecycle())
    expect(result.current.absoluteFirst).toBe(true)
    expect(result.current.secondsRemaining).toBe(45)
    expect(result.current.warning).toBe(true)
  })
})
