import { createSlice } from '@reduxjs/toolkit'

// 'unknown' 이 없으면 보호 화면에서 새로고침할 때 세션 복구가 끝나기 전에
// 미인증으로 판단해 로그인 화면이 한 번 번쩍인다.
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
}

const initialState: AuthState = { status: 'unknown' }

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authenticated: (state) => {
      state.status = 'authenticated'
    },
    anonymous: (state) => {
      state.status = 'anonymous'
    },
  },
  selectors: {
    selectAuthStatus: (state) => state.status,
  },
})

export const { authenticated, anonymous } = authSlice.actions
export const { selectAuthStatus } = authSlice.selectors
