import { useEffect } from 'react'
import { useMeQuery } from '../api/authApi'
import { useLogout } from './useLogout'

/**
 * 세션 중에 거절당한 사용자를 끊는다.
 *
 * 관리자가 거절하면 refresh 토큰은 폐기되지만 **access token 은 무효화할 수 없다** —
 * 서명만으로 검증되므로 서버가 취소할 방법이 없다. 그래서 거절 후에도 최대 30분
 * (`access-token-ttl`) 동안 인증 API 가 열려 있다.
 *
 * `me` 의 `status` 를 보고 이 브라우저에서만 끊는다. **완화책이지 차단이 아니다** —
 * 직접 요청을 만드는 클라이언트에는 통하지 않는다. 근본 해법은 백엔드 몫이다.
 */
export const useRejectedGuard = (): void => {
  const { data: me } = useMeQuery()
  const { logout } = useLogout()

  useEffect(() => {
    if (me?.status === 'REJECTED') void logout()
  }, [me?.status, logout])
}
