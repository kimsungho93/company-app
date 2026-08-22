const MAX_LENGTH = 29

export const validateRoomName = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '방 이름을 입력해 주세요.'
  if (trimmed.length > MAX_LENGTH) return `방 이름은 ${MAX_LENGTH}자까지 입력할 수 있습니다.`
  return null
}
