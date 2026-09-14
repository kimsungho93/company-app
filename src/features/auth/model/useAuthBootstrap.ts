import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { reissueOnce } from '@/shared/api'
import { anonymous, authenticated } from './authSlice'

export const useAuthBootstrap = (): void => {
  const dispatch = useDispatch()

  useEffect(() => {
    let cancelled = false

    reissueOnce().then((ok) => {
      if (cancelled) return
      dispatch(ok ? authenticated() : anonymous())
    })

    return () => {
      cancelled = true
    }
  }, [dispatch])
}
