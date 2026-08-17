const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 가입 시각을 `2026-08-18 07:11:11` 로 만든다. 항상 한국 시간이다.
 *
 * 문자열을 잘라 쓰지 않는다. 백엔드가 `Instant` 를 그대로 직렬화하는데
 * Jackson 기본값이면 UTC(`...Z`)로 나가고, 그걸 자르면 **9시간 어긋난 값**이
 * 화면에 뜬다. 어느 형식으로 오든 맞도록 파싱한 뒤 KST 로 옮긴다.
 *
 * 브라우저 표준시에 기대지 않고 KST 로 고정하는 이유는, 백엔드가 로그·DB·화면을
 * 전부 한국 시간으로 맞춰뒀기 때문이다. 다른 표준시의 기기에서 봐도 같은 값이어야
 * 장애 때 시각을 맞춰볼 수 있다.
 */
export const formatJoinedAt = (value: string): string => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  const kst = new Date(parsed.getTime() + KST_OFFSET_MS)

  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` +
    ` ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:${pad(kst.getUTCSeconds())}`
  )
}
