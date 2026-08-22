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
