import { useEffect, useRef } from 'react'
import { useMeQuery } from '../api/authApi'
import { useLogout } from './useLogout'

export const useRejectedGuard = (): void => {
  const { data: me } = useMeQuery()
  const { logout } = useLogout()
  const firedRef = useRef(false)

  useEffect(() => {
    if (me?.status !== 'REJECTED' || firedRef.current) return

    firedRef.current = true
    void logout()
  }, [me?.status, logout])
}
