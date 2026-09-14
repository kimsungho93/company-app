import { toErrorInfo } from '@/shared/api'

export interface ActionNotice {
  ok: boolean
  text: string

  detail: string[]
}

const MAX_NAMES = 5

const namesOf = (names: string[]): string =>
  names.length <= MAX_NAMES
    ? names.join(', ')
    : `${names.slice(0, MAX_NAMES).join(', ')} 외 ${names.length - MAX_NAMES}명`

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
