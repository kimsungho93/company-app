import type { Avatar } from '../api/types'

export interface AvatarOption {
  value: Avatar
  label: string
  src: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { value: 'MALE', label: '남자 아바타', src: '/avatars/male.png' },
  { value: 'FEMALE', label: '여자 아바타', src: '/avatars/female.png' },
]

export const DEFAULT_AVATAR: Avatar = 'MALE'

export const avatarOption = (avatar: Avatar | null): AvatarOption =>
  AVATAR_OPTIONS.find((option) => option.value === (avatar ?? DEFAULT_AVATAR)) ?? AVATAR_OPTIONS[0]
