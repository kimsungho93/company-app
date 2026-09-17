import { fetchBaseQuery } from '@reduxjs/toolkit/query'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { API_BASE } from './apiBase'
import { reissueOnce } from './reissue'
import {
  clearPendingLogout,
  getPendingLogout,
  errorCode,
  isSessionEndCode,
  sessionEndReasonFor,
  sessionStore,
  withAuthLock,
} from './sessionStore'
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

const NO_REISSUE = ['/auth/login', '/auth/signup', '/auth/reissue', '/auth/logout']
const urlOf = (args: string | FetchArgs) => (typeof args === 'string' ? args : args.url)
const authChanged = () => ({
  error: { status: 'CUSTOM_ERROR' as const, error: '인증 상태가 변경되었습니다.' },
})

export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const url = urlOf(args)
  const generation = tokenStore.generation()
  const pendingLogout = getPendingLogout()
  let result = await (url === '/auth/logout' || url === '/auth/login'
    ? withAuthLock(async () => {
        if (
          generation !== tokenStore.generation() ||
          (url === '/auth/logout' && pendingLogout !== getPendingLogout())
        )
          return authChanged()
        return await raw(args, api, extraOptions)
      }).catch((cause: unknown) => ({
        error: {
          status: 'CUSTOM_ERROR' as const,
          error: cause instanceof Error ? cause.message : '로그인 동기화를 시작할 수 없습니다.',
        },
      }))
    : raw(args, api, extraOptions))

  if (url === '/auth/logout' && !result.error) clearPendingLogout(pendingLogout)
  if (NO_REISSUE.includes(url)) return result
  if (generation !== tokenStore.generation()) {
    return authChanged()
  }
  if (result.error?.status !== 401) return result

  const code = errorCode(result.error.data)
  if (isSessionEndCode(code)) {
    sessionStore.end(code)
    return result
  }

  if (await reissueOnce()) {
    result = await raw(args, api, extraOptions)
    if (generation !== tokenStore.generation()) {
      return authChanged()
    }
    const retryCode = errorCode(result.error?.data)
    if (result.error?.status === 401) {
      sessionStore.end(sessionEndReasonFor(retryCode))
    }
  }
  return result
}
