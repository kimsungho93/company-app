import { useCallback, useState } from 'react'
import { toErrorInfo } from '@/shared/api'
import { useSignupMutation } from '../api/authApi'
import type { SignupRequest } from '../api/authApi'

export type SignupStatus = 'idle' | 'submitting' | 'success'

export type SignupErrorField = 'email' | 'name' | 'password' | null

export interface UseSignupResult {
  status: SignupStatus
  formError: string | null
  fieldError: { field: SignupErrorField; message: string } | null
  submit: (req: SignupRequest) => Promise<boolean>
  clearError: () => void
}

// 백엔드 GlobalExceptionHandler 는 모든 Bean Validation 실패를 INVALID_INPUT 하나로
// 뭉쳐 첫 번째 필드 메시지만 내려준다. 어느 필드인지 알 수 없어 그건 폼 상단에 띄운다.
const FIELD_BY_CODE: Record<string, SignupErrorField> = {
  EMAIL_ALREADY_EXISTS: 'email',
}

export const useSignup = (): UseSignupResult => {
  const [signup, { isLoading, isSuccess }] = useSignupMutation()
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldError, setFieldError] =
    useState<{ field: SignupErrorField; message: string } | null>(null)

  const clearError = useCallback(() => {
    setFormError(null)
    setFieldError(null)
  }, [])

  const submit = useCallback(
    async (req: SignupRequest) => {
      setFormError(null)
      setFieldError(null)
      try {
        await signup(req).unwrap()
        return true
      } catch (e) {
        const info = toErrorInfo(e)
        const field = info.code ? FIELD_BY_CODE[info.code] : undefined
        if (field) setFieldError({ field, message: info.message })
        else setFormError(info.message)
        return false
      }
    },
    [signup],
  )

  const status: SignupStatus = isLoading ? 'submitting' : isSuccess ? 'success' : 'idle'

  return { status, formError, fieldError, submit, clearError }
}
