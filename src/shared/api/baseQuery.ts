import { fetchBaseQuery } from '@reduxjs/toolkit/query'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { API_BASE } from './apiBase'
import { reissueOnce } from './reissue'
import { tokenStore } from './tokenStore'

const raw = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: 'include',
  prepareHeaders: (headers) => {
    const token = tokenStore.get()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// 이 경로들의 401 은 토큰 만료가 아니라 그 자체의 결과다.
// 재발급으로 받아치면 로그인 실패가 조용히 재시도되거나 무한 재귀에 빠진다.
const NO_REISSUE = ['/auth/login', '/auth/signup', '/auth/reissue', '/auth/logout']

const urlOf = (args: string | FetchArgs) => (typeof args === 'string' ? args : args.url)

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await raw(args, api, extraOptions)

  if (result.error?.status !== 401 || NO_REISSUE.includes(urlOf(args))) {
    return result
  }

  // 재시도는 한 번뿐이다. 재발급 후에도 401 이면 그대로 돌려준다.
  if (await reissueOnce()) {
    result = await raw(args, api, extraOptions)
  }

  return result
}
