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

  if (await reissueOnce()) {
    result = await raw(args, api, extraOptions)
  }

  return result
}
