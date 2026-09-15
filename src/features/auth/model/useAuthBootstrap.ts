import { useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { baseApi, reissueSession, sessionStore } from '@/shared/api'
import { anonymous, authenticated, checking, unavailable } from './authSlice'

export const useAuthBootstrap = (): { retry: () => void } => {
  const dispatch = useDispatch()

  const retry = useCallback(() => {
    dispatch(checking())
    void reissueSession().then((result) => {
      if (result === 'cancelled') {
        if (sessionStore.get().ended) dispatch(anonymous())
        return
      }
      dispatch(result === 'success' ? authenticated() : result === 'retryable' ? unavailable() : anonymous())
    })
  }, [dispatch])

  useEffect(() => {
    sessionStore.initialize()
    const unsubscribe = sessionStore.onEvent((event) => {
      dispatch(baseApi.util.resetApiState())
      dispatch(event.type === 'ended' ? anonymous() : authenticated())
    })
    retry()
    return unsubscribe
  }, [dispatch, retry])

  return { retry }
}
