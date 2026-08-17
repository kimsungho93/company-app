import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router'
import { selectAuthStatus } from '../model/authSlice'

// 세션 복구가 끝나기 전에는 판단하지 않는다. 바로 리다이렉트하면
// 보호 화면에서 새로고침할 때 로그인 화면이 한 번 번쩍인다.
export const RequireAuth = () => {
  const status = useSelector(selectAuthStatus)

  if (status === 'unknown') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  return <Outlet />
}

export const RedirectIfAuthenticated = () => {
  const status = useSelector(selectAuthStatus)

  if (status === 'unknown') return null
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
