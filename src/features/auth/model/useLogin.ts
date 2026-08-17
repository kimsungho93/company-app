import { useCallback, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { useLoginMutation } from '../api/authApi'
import type { LoginRequest } from '../api/types'

export type LoginStatus = 'idle' | 'submitting' | 'success'

export interface UseLoginResult {
  status: LoginStatus
  formError: string | null
  submit: (req: LoginRequest) => Promise<boolean>
  clearError: () => void
}

export const useLogin = (): UseLoginResult => {
  const [login, { isLoading, isSuccess }] = useLoginMutation()
  const [formError, setFormError] = useState<string | null>(null)

  const submit = useCallback(
    async (req: LoginRequest) => {
      setFormError(null)
      try {
        await login(req).unwrap()
        return true
      } catch (e) {
        const info = toErrorInfo(e)
        // 401 은 어느 쪽이 틀렸는지 알려주지 않는다. 계정 열거를 막기 위해서다.
        setFormError(
          info.kind === 'UNAUTHORIZED'
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : info.message,
        )
        return false
      }
    },
    [login],
  )

  const clearError = useCallback(() => setFormError(null), [])

  const status: LoginStatus = isLoading ? 'submitting' : isSuccess ? 'success' : 'idle'

  return { status, formError, submit, clearError }
}
