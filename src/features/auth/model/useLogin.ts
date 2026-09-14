import { useCallback, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import type { ApiErrorInfo } from '@/shared/api'
import { useLoginMutation } from '../api/authApi'
import type { LoginRequest } from '../api/types'

const APPROVAL_MESSAGES: Record<string, string> = {
  APPROVAL_PENDING: '관리자 승인 대기 중입니다. 승인 후 이용할 수 있습니다.',
  SIGNUP_REJECTED: '가입이 거절되었습니다. 관리자에게 문의해 주세요.',
}

const messageFor = (info: ApiErrorInfo): string => {
  const approval = info.code ? APPROVAL_MESSAGES[info.code] : undefined
  if (approval) return approval

  if (info.kind === 'UNAUTHORIZED') return '이메일 또는 비밀번호가 올바르지 않습니다.'
  return info.message
}

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
        setFormError(messageFor(toErrorInfo(e)))
        return false
      }
    },
    [login],
  )

  const clearError = useCallback(() => setFormError(null), [])

  const status: LoginStatus = isLoading ? 'submitting' : isSuccess ? 'success' : 'idle'

  return { status, formError, submit, clearError }
}
