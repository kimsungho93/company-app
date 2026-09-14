import { baseApi, tokenStore } from '@/shared/api'
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
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          tokenStore.set(data.accessToken)
          dispatch(authenticated())
        } catch {

        }
      },
    }),

    signup: build.mutation<void, SignupRequest>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),

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

export const { useMeQuery, useLoginMutation, useSignupMutation, useLogoutMutation } = authApi
