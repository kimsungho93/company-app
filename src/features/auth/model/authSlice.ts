import { createSlice } from '@reduxjs/toolkit'

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous' | 'unavailable'

interface AuthState { status: AuthStatus }
const initialState: AuthState = { status: 'unknown' }

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authenticated: (state) => { state.status = 'authenticated' },
    anonymous: (state) => { state.status = 'anonymous' },
    unavailable: (state) => { state.status = 'unavailable' },
    checking: (state) => { state.status = 'unknown' },
  },
  selectors: { selectAuthStatus: (state) => state.status },
})

export const { authenticated, anonymous, unavailable, checking } = authSlice.actions
export const { selectAuthStatus } = authSlice.selectors
