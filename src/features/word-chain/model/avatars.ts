import type { Avatar } from '../api/types'

export interface AvatarOption {
  value: Avatar
  label: string
  src: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { value: 'MALE', label: '남자 아바타', src: '/avatars/male.png' },
  { value: 'FEMALE', label: '여자 아바타', src: '/avatars/female.png' },
  { value: 'YELLOW_KNIT', label: '노란 니트 아바타', src: '/avatars/yellow-knit.png' },
  { value: 'HEADPHONES', label: '헤드폰 아바타', src: '/avatars/headphones.png' },
  { value: 'CARDIGAN', label: '카디건 아바타', src: '/avatars/cardigan.png' },
  { value: 'HOODIE', label: '후드 아바타', src: '/avatars/hoodie.png' },
  { value: 'GLASSES', label: '안경 아바타', src: '/avatars/glasses.png' },
]

export const DEFAULT_AVATAR: Avatar = 'MALE'

export const avatarOption = (avatar: Avatar | null): AvatarOption =>
  AVATAR_OPTIONS.find((option) => option.value === (avatar ?? DEFAULT_AVATAR)) ?? AVATAR_OPTIONS[0]
