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

export type Avatar =
  | 'MALE'
  | 'FEMALE'
  | 'YELLOW_KNIT'
  | 'HEADPHONES'
  | 'CARDIGAN'
  | 'HOODIE'
  | 'GLASSES'

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
  serverNow: number
  turnSeconds: number
  noReuse: boolean
  game: GameState | null
}

export type BubbleState = 'PENDING' | 'PASS' | 'FAIL'

export type FailReason =
  | 'NOT_THREE_LETTERS'
  | 'NOT_CHAINED'
  | 'ALREADY_USED'
  | 'NOT_IN_DICTIONARY'

export interface Bubble {
  userId: number
  word: string
  state: BubbleState
  verified?: boolean
  reason?: FailReason | null
}

export interface GameState {
  currentWord: string
  turnUserId: number | null
  turnEndsAt: number | null
  triesLeft: number
  usedWords: string[]
  turnOrder: number[]
  eliminated: number[]
  bubbles: Bubble[]
  winnerId: number | null
}

export interface GameOptionsValue {
  turnSeconds: number
  noReuse: boolean
}
