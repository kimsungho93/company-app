import { configureStore } from '@reduxjs/toolkit'
import { authSlice } from '@/features/auth'
import { baseApi } from '@/shared/api'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [authSlice.reducerPath]: authSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
