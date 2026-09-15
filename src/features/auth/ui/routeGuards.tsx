import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router'
import { selectAuthStatus } from '../model/authSlice'

export const RequireAuth = () => {
  const status = useSelector(selectAuthStatus)
  if (status === 'unknown' || status === 'unavailable') return null
  if (status === 'anonymous') return <Navigate to="/login" replace />
  return <Outlet />
}

export const RedirectIfAuthenticated = () => {
  const status = useSelector(selectAuthStatus)
  if (status === 'unknown' || status === 'unavailable') return null
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
