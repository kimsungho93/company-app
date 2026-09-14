import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { TextField } from '@/shared/ui/TextField'
import { useSignup } from '../model/useSignup'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateName,
  validateNewPassword,
  validatePasswordConfirm,
  validateSignupEmail,
} from '../model/validateSignup'
import { AuthCard } from './AuthCard'
import styles from './AuthCard.module.scss'

interface FieldErrors {
  email: string | null
  name: string | null
  password: string | null
  confirm: string | null
}

const NO_ERRORS: FieldErrors = { email: null, name: null, password: null, confirm: null }

export const SignupForm = () => {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS)
  const [submitted, setSubmitted] = useState(false)

  const { status, formError, fieldError, submit, clearError } = useSignup()
  const busy = status === 'submitting'

  const revalidate = (next: {
    email: string
    name: string
    password: string
    confirm: string
  }) => {
    const result: FieldErrors = {
      email: validateSignupEmail(next.email),
      name: validateName(next.name),
      password: validateNewPassword(next.password),
      confirm: validatePasswordConfirm(next.password, next.confirm),
    }
    setErrors(result)
    return !result.email && !result.name && !result.password && !result.confirm
  }

  const current = { email, name, password, confirm }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
    clearError()
    if (!revalidate(current)) return

    const trimmedEmail = email.trim()
    const ok = await submit({ email: trimmedEmail, name: name.trim(), password })
    if (ok) {
      navigate('/login', { replace: true, state: { signedUpEmail: trimmedEmail } })
    }
  }

  const errorFor = (field: 'email' | 'name' | 'password') =>
    (fieldError?.field === field ? fieldError.message : null) ??
    (submitted ? errors[field] : null)

  return (
    <AuthCard
      title="계정 만들기"
      subtitle="회사 이메일로 가입하고 서비스를 이용해보세요"
      footer={
        <>
          <div className={styles.divider}>이미 계정이 있으신가요?</div>
          <p className={styles.foot}>
            <Link className={styles.footLink} to="/login">
              로그인하기
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <TextField
          label="이메일"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus

          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="name@ibslab.com"
          value={email}
          disabled={busy}
          error={errorFor('email')}
          onChange={(e) => {

            const next = e.target.value.toLowerCase()
            setEmail(next)
            if (submitted) revalidate({ ...current, email: next })
            if (fieldError?.field === 'email') clearError()
          }}
          onBlur={(e) =>
            setErrors((prev) => ({ ...prev, email: validateSignupEmail(e.target.value) }))
          }
        />

        <TextField
          label="이름"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="홍길동"
          value={name}
          disabled={busy}
          error={errorFor('name')}
          onChange={(e) => {
            setName(e.target.value)
            if (submitted) revalidate({ ...current, name: e.target.value })
          }}
          onBlur={(e) => setErrors((prev) => ({ ...prev, name: validateName(e.target.value) }))}
        />

        <TextField
          label="비밀번호"
          type="password"
          name="password"

          autoComplete="new-password"
          placeholder="••••••••••"
          value={password}
          disabled={busy}
          help={`${PASSWORD_MIN}~${PASSWORD_MAX}자`}
          error={errorFor('password')}
          onChange={(e) => {
            setPassword(e.target.value)
            if (submitted) revalidate({ ...current, password: e.target.value })
          }}
          onBlur={(e) =>
            setErrors((prev) => ({ ...prev, password: validateNewPassword(e.target.value) }))
          }
        />

        <TextField
          label="비밀번호 확인"
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder="••••••••••"
          value={confirm}
          disabled={busy}
          error={submitted ? errors.confirm : null}
          onChange={(e) => {
            setConfirm(e.target.value)
            if (submitted) revalidate({ ...current, confirm: e.target.value })
          }}
          onBlur={(e) =>
            setErrors((prev) => ({
              ...prev,
              confirm: validatePasswordConfirm(password, e.target.value),
            }))
          }
        />

        <Button type="submit" variant="accent" size="large" fullWidth loading={busy}>{status === 'success' ? '가입 완료' : '가입하기'}</Button>
      </form>

    </AuthCard>
  )
}
