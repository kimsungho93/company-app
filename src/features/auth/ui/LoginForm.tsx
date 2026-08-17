import { useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { TextField } from '@/shared/ui/TextField'
import {
  clearRememberedEmail,
  loadRememberedEmail,
  saveRememberedEmail,
} from '../model/rememberedEmail'
import { useLogin } from '../model/useLogin'
import { validateEmail, validatePassword } from '../model/validate'
import styles from './AuthCard.module.scss'

interface LocationState {
  signedUpEmail?: string
}

interface FieldErrors {
  email: string | null
  password: string | null
}

const NO_ERRORS: FieldErrors = { email: null, password: null }

export const LoginForm = () => {
  const cardRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const signedUpEmail = (useLocation().state as LocationState | null)?.signedUpEmail ?? null

  // 방금 가입한 주소가 저장된 주소보다 우선한다 — 그 계정으로 들어가려는 의도가 명확하다.
  const [initialEmail] = useState(() => signedUpEmail ?? loadRememberedEmail())
  const [email, setEmail] = useState(initialEmail ?? '')
  const [remember, setRemember] = useState(loadRememberedEmail() !== null)
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS)
  const [submitted, setSubmitted] = useState(false)
  const { status, formError, submit, clearError } = useLogin()

  const busy = status === 'submitting'

  const revalidate = (nextEmail: string, nextPassword: string) => {
    const next = {
      email: validateEmail(nextEmail),
      password: validatePassword(nextPassword),
    }
    setErrors(next)
    return !next.email && !next.password
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
    clearError()
    if (!revalidate(email, password)) return

    const trimmed = email.trim()
    const ok = await submit({ email: trimmed, password })

    if (!ok) return

    // 성공했을 때만 저장한다. 오타로 실패한 주소를 기억해두면
    // 다음 로그인에서 그 오타가 그대로 채워진다.
    if (remember) saveRememberedEmail(trimmed)
    else clearRememberedEmail()

    navigate('/', { replace: true })
  }

  // state 를 거치면 pointermove 마다 리렌더된다.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--cx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--cy', `${e.clientY - rect.top}px`)
  }

  return (
    <div className={styles.card} ref={cardRef} onPointerMove={onPointerMove}>
      <i className={`${styles.align} ${styles.tl}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.tr}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.bl}`} aria-hidden="true" />
      <i className={`${styles.align} ${styles.br}`} aria-hidden="true" />

      <h1 className={styles.title}>
        {/* 웨이퍼 캔버스가 aria-hidden 이라 브랜드를 전달할 곳이 여기뿐이다.
            화면에는 안 보이고 스크린리더에만 읽힌다. */}
        <span className={styles.srOnly}>IBS</span>
        다시 만나서 반가워요
      </h1>
      <p className={styles.subtitle}>계정으로 로그인하고 서비스를 이용해보세요</p>

      <form onSubmit={onSubmit} noValidate>
        {signedUpEmail && !formError && (
          <p className={styles.formNotice} role="status">
            가입이 완료됐습니다. 비밀번호를 입력해 로그인하세요.
          </p>
        )}

        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <TextField
          label="이메일"
          type="email"
          name="email"
          // 이게 없으면 비밀번호 관리자가 동작하지 않는다
          autoComplete="email"
          autoFocus={initialEmail === null}
          placeholder="name@ibslab.com"
          value={email}
          disabled={busy}
          error={submitted ? errors.email : null}
          onChange={(e) => {
            setEmail(e.target.value)
            if (submitted) revalidate(e.target.value, password)
          }}
          onBlur={(e) => setErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }))}
        />

        <TextField
          label="비밀번호"
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus={initialEmail !== null}
          placeholder="••••••••••"
          value={password}
          disabled={busy}
          error={submitted ? errors.password : null}
          aside={<a className={styles.link} href="#help">비밀번호 찾기</a>}
          onChange={(e) => {
            setPassword(e.target.value)
            if (submitted) revalidate(email, e.target.value)
          }}
          onBlur={(e) =>
            setErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }))
          }
        />

        <div className={styles.options}>
          <Checkbox
            label="아이디 저장"
            checked={remember}
            disabled={busy}
            onChange={(e) => setRemember(e.target.checked)}
          />
        </div>

        <Button loading={busy}>{status === 'success' ? '접속 중…' : '로그인'}</Button>
      </form>

      <div className={styles.divider}>계정이 없으신가요?</div>
      <p className={styles.foot}>
        <Link className={styles.footLink} to="/signup">
          회원가입하기
        </Link>
      </p>
    </div>
  )
}
