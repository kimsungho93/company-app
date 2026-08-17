import { configureStore } from '@reduxjs/toolkit'
import { authSlice } from '@/features/auth'
import { baseApi } from '@/shared/api'

// access token 은 store 에 넣지 않는다. DevTools 에 그대로 노출되고
// redux-persist 를 붙이면 localStorage 로 샌다. shared/api/tokenStore 를 쓸 것.
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [authSlice.reducerPath]: authSlice.reducer,
  },
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
