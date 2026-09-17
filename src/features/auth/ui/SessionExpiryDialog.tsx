import { useState } from 'react'
import { useLogoutMutation } from '../api/authApi'
import { useSessionLifecycle } from '../model/useSessionLifecycle'
import { Button } from '@/shared/ui/Button'
import { Dialog } from '@/shared/ui/Dialog'
import styles from './SessionExpiryDialog.module.scss'

export const SessionExpiryDialog = () => {
  const {
    warning,
    expired,
    absoluteFirst,
    secondsRemaining,
    busy,
    failed,
    continueSession,
    verify,
  } = useSessionLifecycle()
  const [logout, { isLoading }] = useLogoutMutation()
  const [checking, setChecking] = useState(false)

  const recheck = async () => {
    setChecking(true)
    await verify()
    setChecking(false)
  }

  return (
    <Dialog
      open={warning}
      labelledBy="session-expiry-title"
      describedBy="session-expiry-description"
      dismissible={false}
      onDismiss={() => undefined}
      className={styles.dialog}
    >
      <h2 id="session-expiry-title">
        {expired
          ? '로그인 상태를 확인하고 있어요'
          : absoluteFirst
            ? '곧 다시 로그인해야 해요'
            : '잠시 자리를 비우셨나요?'}
      </h2>
      <p id="session-expiry-description">
        {expired
          ? '안전한 이용을 위해 로그인 유효 시간을 확인하고 있습니다.'
          : absoluteFirst
            ? `최대 이용 시간에 도달하여 ${secondsRemaining}초 후 로그아웃됩니다. 다시 로그인해 주세요.`
            : `${secondsRemaining}초 후 자동으로 로그아웃됩니다. 계속 이용하시려면 아래 버튼을 눌러 주세요.`}
      </p>
      {failed && (
        <p className={styles.error} role="alert">
          서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.
        </p>
      )}
      <div className={styles.actions}>
        <Button
          variant="secondary"
          loading={isLoading}
          onClick={() => {
            void logout()
              .unwrap()
              .catch(() => undefined)
          }}
        >
          로그아웃
        </Button>
        {expired ? (
          <Button
            loading={checking}
            onClick={() => {
              void recheck()
            }}
          >
            다시 확인
          </Button>
        ) : (
          !absoluteFirst && (
            <Button
              loading={busy}
              onClick={() => {
                void continueSession()
              }}
            >
              계속 사용
            </Button>
          )
        )}
      </div>
    </Dialog>
  )
}
