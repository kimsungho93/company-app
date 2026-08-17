import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { reissueOnce } from '@/shared/api'
import { anonymous, authenticated } from './authSlice'

/**
 * access token 은 메모리에만 있어 새로고침하면 사라진다.
 * refresh 쿠키는 남아 있으므로 앱 시작 시 한 번 재발급해 세션을 복구한다.
 * 이 훅이 없으면 새로고침이 곧 로그아웃이다.
 */
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
