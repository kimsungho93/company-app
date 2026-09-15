import { baseApi, sessionStore, tokenStore } from '@/shared/api'
import { anonymous, authenticated } from '../model/authSlice'
import type { LoginRequest, LoginResponse, Me } from './types'

export interface SignupRequest {
  email: string
  name: string
  password: string
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    me: build.query<Me, void>({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body, timeout: 15_000 }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const generation = sessionStore.beginLogin()
        try {
          const { data } = await queryFulfilled
          if (generation !== tokenStore.generation()) return
          tokenStore.set(data.accessToken)
          sessionStore.accept(data, true)
          dispatch(authenticated())
        } catch {
          return
        }
      },
    }),
    signup: build.mutation<void, SignupRequest>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST', timeout: 15_000 }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        sessionStore.end('LOGOUT')
        dispatch(anonymous())
        try {
          await queryFulfilled
        } catch {
          return
        } finally {
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),
  }),
})

export const { useMeQuery, useLoginMutation, useSignupMutation, useLogoutMutation } = authApi
