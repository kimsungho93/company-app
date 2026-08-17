import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export type ApiErrorKind = 'UNAUTHORIZED' | 'NETWORK' | 'SERVER' | 'CLIENT'

export interface ApiErrorInfo {
  kind: ApiErrorKind
  code: string | null
  message: string
}

interface ServerErrorBody {
  code?: string
  message?: string
}

const NETWORK_MESSAGE = '네트워크에 연결할 수 없습니다.'
const SERVER_MESSAGE = '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'

/**
 * RTK Query 의 오류를 화면이 쓸 형태로 좁힌다.
 * status 는 숫자가 아니라 'FETCH_ERROR' 같은 문자열일 수 있다.
 */
export const toErrorInfo = (error: unknown): ApiErrorInfo => {
  const e = error as FetchBaseQueryError | undefined
  if (!e || !('status' in e)) {
    return { kind: 'CLIENT', code: null, message: '알 수 없는 오류가 발생했습니다.' }
  }

  if (typeof e.status !== 'number') {
    return { kind: 'NETWORK', code: null, message: NETWORK_MESSAGE }
  }

  const body = (e.data ?? {}) as ServerErrorBody
  const kind: ApiErrorKind =
    e.status === 401 ? 'UNAUTHORIZED' : e.status >= 500 ? 'SERVER' : 'CLIENT'

  return {
    kind,
    code: body.code ?? null,
    message: body.message ?? (kind === 'SERVER' ? SERVER_MESSAGE : '요청을 처리하지 못했습니다.'),
  }
}
