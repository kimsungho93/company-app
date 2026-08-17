import { Navigate, Outlet } from 'react-router'
import { useMeQuery } from '../api/authApi'

// me 가 도착하기 전에는 판단하지 않는다. role 을 모르는 채로 리다이렉트하면
// 관리자인데도 홈으로 튕긴다. RequireAuth 의 'unknown' 처리와 같은 규칙이다.
export const RequireAdmin = () => {
  const { data: me, isLoading } = useMeQuery()

  if (isLoading || !me) return null
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}
