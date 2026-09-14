import { API_BASE } from './apiBase'
import { tokenStore } from './tokenStore'

interface ReissueResponse {
  accessToken: string
  expiresIn: number
}

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
