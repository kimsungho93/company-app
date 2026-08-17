import { toErrorInfo } from '@/shared/api'

export interface ActionNotice {
  ok: boolean
  text: string
  /** 실패 사유별로 한 줄씩. 성공만 있으면 빈 배열이다 */
  detail: string[]
}

/** 사유 한 줄에 이름을 몇 개까지 늘어놓을지. 넘으면 '외 N명' 으로 접는다 */
const MAX_NAMES = 5

const namesOf = (names: string[]): string =>
  names.length <= MAX_NAMES
    ? names.join(', ')
    : `${names.slice(0, MAX_NAMES).join(', ')} 외 ${names.length - MAX_NAMES}명`

/**
 * 일괄 처리 결과를 사람이 읽을 문장으로 만든다.
 *
 * `Promise.allSettled` 는 순서를 보존하므로 `results[i]` 가 `targets[i]` 다.
 * 그 짝을 버리고 개수만 세면 "5명 중 2명 실패" 까지밖에 말할 수 없다.
 * 관리자는 **누가** 실패했는지 알아야 다시 시도할지 넘어갈지 정한다.
 */
export const summarizeResults = (
  targets: readonly { name: string }[],
  results: readonly PromiseSettledResult<unknown>[],
  verb: string,
): ActionNotice => {
  const failed = targets.filter((_, i) => results[i]?.status === 'rejected')
  const total = targets.length
  const succeeded = total - failed.length

  if (failed.length === 0) {
    return { ok: true, text: `${total}명을 ${verb}했습니다.`, detail: [] }
  }

  // 단건이면 사유 자체가 안내다. '1명 중 1명 실패' 는 아무것도 알려주지 않는다.
  if (total === 1) {
    const only = results[0]
    const message =
      only?.status === 'rejected' ? toErrorInfo(only.reason).message : '처리하지 못했습니다.'
    return { ok: false, text: message, detail: [] }
  }

  const byReason = new Map<string, string[]>()
  targets.forEach((target, i) => {
    const result = results[i]
    if (result?.status !== 'rejected') return
    const reason = toErrorInfo(result.reason).message
    byReason.set(reason, [...(byReason.get(reason) ?? []), target.name])
  })

  return {
    ok: false,
    text:
      succeeded === 0
        ? `${total}명 모두 ${verb}하지 못했습니다.`
        : `${succeeded}명을 ${verb}했습니다. ${failed.length}명은 처리하지 못했습니다.`,
    detail: [...byReason].map(([reason, names]) => `${reason} — ${namesOf(names)}`),
  }
}
