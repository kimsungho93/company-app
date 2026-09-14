import { Navigate, Outlet } from 'react-router'
import { useMeQuery } from '../api/authApi'

export const RequireAdmin = () => {
  const { data: me, isLoading } = useMeQuery()

  if (isLoading || !me) return null
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}
