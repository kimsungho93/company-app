import type { LotterySettings } from '../api/types'

export const DEFAULT_PARTICIPANTS = ['선도우', '육이슬', '유영진', '이정규', '김성호', '허소영', '김예린', '김현진', '이다혜', '박찬진', '문형석', '나예린', '김민수']

export const parseParticipants = (text: string): string[] =>
  text.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)

export const validateLotteryTitle = (title: string): string | null => {
  const length = title.trim().length
  return length < 1 || length > 60 ? '방 이름을 1~60자로 입력해 주세요.' : null
}

export const validateLotterySettings = ({ participants, winnerCount }: LotterySettings): string | null => {
  if (participants.length < 1 || participants.length > 50) return '참가자는 1~50명까지 등록할 수 있습니다.'
  const names = participants.map((name) => name.trim())
  if (names.some((name) => name.length < 1 || name.length > 30)) return '참가자 이름을 1~30자로 입력해 주세요.'
  if (new Set(names).size !== names.length) return '같은 이름의 참가자가 있습니다.'
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > participants.length) {
    return '당첨 인원은 1명 이상, 참가자 수 이하여야 합니다.'
  }
  return null
}
