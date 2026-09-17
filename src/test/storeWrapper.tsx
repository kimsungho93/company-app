import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { authSlice } from '@/features/auth'
import { baseApi } from '@/shared/api'

export interface TestWrapperOptions {
  withRouter?: boolean

  route?: string
}

export const createTestWrapper = ({ withRouter = false, route = '/' }: TestWrapperOptions = {}) => {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      [authSlice.reducerPath]: authSlice.reducer,
    },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      {withRouter ? <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> : children}
    </Provider>
  )

  return { store, wrapper }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const emptyResponse = (status = 201) => new Response(null, { status })
