import { createSlice } from '@reduxjs/toolkit'

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
