export type RoomStatus = 'WAITING' | 'PLAYING'

export interface RoomSummary {
  id: number
  name: string
  hostName: string
  playerCount: number
  capacity: number
  locked: boolean
  status: RoomStatus
}

export interface CreateRoomDraft {
  name: string
  password?: string
}

export interface JoinRoomDraft {
  id: number
  password?: string
}

export type Avatar = 'MALE' | 'FEMALE'

export interface Player {
  userId: number
  name: string
  avatar: Avatar | null
  ready: boolean
}

export interface RoomState {
  id: number
  name: string
  status: RoomStatus
  hostId: number
  capacity: number
  players: Player[]
}
