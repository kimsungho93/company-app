import { baseApi, tokenStore } from '@/shared/api'
import { anonymous, authenticated } from '../model/authSlice'
import type { LoginRequest, LoginResponse } from './types'

export interface SignupRequest {
  email: string
  name: string
  password: string
}

// 명세: docs/api/auth.md
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          tokenStore.set(data.accessToken)
          dispatch(authenticated())
        } catch {
          // 실패는 훅에서 처리한다
        }
      },
    }),

    signup: build.mutation<void, SignupRequest>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      // 서버 요청이 실패해도 이 브라우저에서는 로그아웃시킨다.
      // 남겨두면 사용자는 로그아웃한 줄 아는데 세션이 살아 있다.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          tokenStore.clear()
          dispatch(anonymous())
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),
  }),
})

export const { useLoginMutation, useSignupMutation, useLogoutMutation } = authApi
