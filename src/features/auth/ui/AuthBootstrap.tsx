import { Fragment, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { sessionStore } from '@/shared/api'
import { useSelector } from 'react-redux'
import { Button } from '@/shared/ui/Button'
import { selectAuthStatus } from '../model/authSlice'
import { useAuthBootstrap } from '../model/useAuthBootstrap'
import { SessionExpiryDialog } from './SessionExpiryDialog'
import styles from './SessionExpiryDialog.module.scss'

export const AuthBootstrap = ({ children }: { children: ReactNode }) => {
  const { retry } = useAuthBootstrap()
  const { session, ended } = useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
  const status = useSelector(selectAuthStatus)
  if (status === 'unknown' || (status === 'authenticated' && ended)) {
    return (
      <div className={styles.bootstrap} role="status">
        로그인 상태를 확인하고 있어요…
      </div>
    )
  }
  if (status === 'unavailable') {
    return (
      <div className={styles.bootstrap}>
        <p role="alert">
          {navigator.locks
            ? '로그인 상태를 확인하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
            : '이 브라우저에서는 안전한 로그인을 지원하지 않습니다. 최신 브라우저에서 다시 시도해 주세요.'}
        </p>
        <Button onClick={retry}>다시 시도</Button>
      </div>
    )
  }
  return (
    <Fragment key={session?.sessionId ?? 'anonymous'}>
      {children}
      {status === 'authenticated' && <SessionExpiryDialog />}
    </Fragment>
  )
}
