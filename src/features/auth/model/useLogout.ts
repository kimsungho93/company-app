import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useLogoutMutation } from '../api/authApi'

export interface UseLogoutResult {
  logout: () => Promise<void>
  isLoading: boolean
}

export const useLogout = (): UseLogoutResult => {
  const [logoutMutation, { isLoading }] = useLogoutMutation()
  const navigate = useNavigate()

  const logout = useCallback(async () => {
    // 서버 요청 실패와 무관하게 로컬 상태는 정리된다(authApi 의 onQueryStarted).
    await logoutMutation().unwrap().catch(() => undefined)
    navigate('/login', { replace: true })
  }, [logoutMutation, navigate])

  return { logout, isLoading }
}
