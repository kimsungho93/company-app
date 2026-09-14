import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseApi } from './baseApi'
import { tokenStore } from './tokenStore'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const testApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    protectedThing: build.query<{ ok: boolean }, void>({
      query: () => ({ url: '/things' }),
    }),
  }),
})

const createStore = () =>
  configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  })

const urlOf = (call: unknown[]) => String(call[0])

describe('baseQuery 401 처리', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    tokenStore.clear()
  })

  it('401 이면 재발급 후 원 요청을 한 번 재시도한다', async () => {
    tokenStore.set('expired')
    const fetchMock = vi.fn().mockImplementation((input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/auth/reissue')) {
        return Promise.resolve(json({ accessToken: 'fresh', expiresIn: 1800 }))
      }
      return Promise.resolve(
        tokenStore.get() === 'fresh' ? json({ ok: true }) : json({ code: 'TOKEN_EXPIRED' }, 401),
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = createStore()
    const result = await store.dispatch(testApi.endpoints.protectedThing.initiate())

    expect(result.data).toEqual({ ok: true })
    expect(tokenStore.get()).toBe('fresh')

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('재발급이 실패하면 재시도하지 않는다', async () => {
    tokenStore.set('expired')
    const fetchMock = vi.fn().mockImplementation((input: Request | string) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/auth/reissue')) return Promise.resolve(json({ code: 'INVALID_TOKEN' }, 401))
      return Promise.resolve(json({ code: 'TOKEN_EXPIRED' }, 401))
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = createStore()
    const result = await store.dispatch(testApi.endpoints.protectedThing.initiate())

    expect(result.error).toBeDefined()
    expect(tokenStore.get()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('로그인 401 은 재발급을 시도하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ code: 'INVALID_CREDENTIALS' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    const store = createStore()
    const loginApi = baseApi.injectEndpoints({
      endpoints: (build) => ({
        testLogin: build.mutation<unknown, void>({
          query: () => ({ url: '/auth/login', method: 'POST', body: {} }),
        }),
      }),
    })

    await store.dispatch(loginApi.endpoints.testLogin.initiate())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.every((c) => !urlOf(c).includes('reissue'))).toBe(true)
  })
})
