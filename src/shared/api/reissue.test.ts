import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reissueOnce } from './reissue'
import { tokenStore } from './tokenStore'

const okResponse = (accessToken: string) =>
  new Response(JSON.stringify({ accessToken, expiresIn: 1800 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('reissueOnce', () => {
  beforeEach(() => {
    tokenStore.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('성공하면 새 토큰을 보관하고 true 를 준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse('fresh')))

    await expect(reissueOnce()).resolves.toBe(true)
    expect(tokenStore.get()).toBe('fresh')
  })

  /**
   * 백엔드는 재발급마다 refresh 토큰을 회전시키고, 폐기된 토큰이 제시되면
   * 재사용으로 보아 그 사용자의 토큰을 전부 무효화한다.
   * 동시에 두 번 나가면 두 번째가 구 토큰을 들고 가 사용자가 강제 로그아웃된다.
   */
  it('동시에 여러 번 불러도 요청은 한 번만 나간다', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(okResponse('fresh')), 20)),
      )
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([reissueOnce(), reissueOnce(), reissueOnce()])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual([true, true, true])
  })

  it('실패하면 토큰을 비우고 false 를 준다', async () => {
    tokenStore.set('stale')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'INVALID_TOKEN' }), { status: 401 }),
      ),
    )

    await expect(reissueOnce()).resolves.toBe(false)
    expect(tokenStore.get()).toBeNull()
  })

  it('네트워크 오류에도 던지지 않고 false 를 준다', async () => {
    tokenStore.set('stale')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(reissueOnce()).resolves.toBe(false)
    expect(tokenStore.get()).toBeNull()
  })

  it('실패한 뒤에도 다음 호출에서 다시 시도할 수 있다', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(okResponse('second'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(reissueOnce()).resolves.toBe(false)
    await expect(reissueOnce()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
