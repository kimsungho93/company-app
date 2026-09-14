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

    await logoutMutation().unwrap().catch(() => undefined)
    navigate('/login', { replace: true })
  }, [logoutMutation, navigate])

  return { logout, isLoading }
}
