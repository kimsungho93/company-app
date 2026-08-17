import { API_BASE } from './apiBase'
import { tokenStore } from './tokenStore'

interface ReissueResponse {
  accessToken: string
  expiresIn: number
}

// 백엔드는 재발급마다 refresh 토큰을 회전시키고, 폐기된 토큰이 한 번이라도 제시되면
// 재사용으로 보아 그 사용자의 유효한 토큰까지 전부 무효화한다(실측 확인).
// 따라서 동시에 두 번 나가면 두 번째가 구 토큰을 들고 가 사용자가 강제 로그아웃된다.
// 진행 중인 Promise 를 공유해 어떤 경우에도 한 번만 나가게 한다.
let inflight: Promise<boolean> | null = null

const call = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE}/auth/reissue`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) {
      tokenStore.clear()
      return false
    }
    const body = (await res.json()) as ReissueResponse
    tokenStore.set(body.accessToken)
    return true
  } catch {
    tokenStore.clear()
    return false
  }
}

export const reissueOnce = (): Promise<boolean> => {
  if (!inflight) {
    inflight = call().finally(() => {
      inflight = null
    })
  }
  return inflight
}
