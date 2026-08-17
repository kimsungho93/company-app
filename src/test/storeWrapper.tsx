import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import type { ReactNode } from 'react'
import { authSlice } from '@/features/auth'
import { baseApi } from '@/shared/api'

export interface TestWrapperOptions {
  /** MemoryRouter 로 감싼다. <Link> 를 쓰는 컴포넌트에 필요하다 */
  withRouter?: boolean
  /** MemoryRouter 초기 경로 */
  route?: string
}

// RTK Query 는 결과를 캐싱한다. 테스트마다 새 store 를 만들지 않으면
// 앞 테스트의 응답이 다음 테스트로 새어 들어간다.
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

/** 201 처럼 본문 없이 성공하는 응답 */
export const emptyResponse = (status = 201) => new Response(null, { status })
