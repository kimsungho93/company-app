export type LotteryRoomStatus = 'READY' | 'DRAWING' | 'FINISHED'

export interface LotteryMember {
  userId: number
  name: string
}

export interface LotteryWinner {
  name: string
  drawnAt: string
}

export interface LotterySettings {
  participants: string[]
  winnerCount: number
}

export interface CreateLotteryRoomRequest extends LotterySettings {
  title: string
}

export interface LotteryRoomSummary {
  id: string
  title: string
  hostId: number
  hostName: string
  status: LotteryRoomStatus
  memberCount: number
  participantCount: number
  winnerCount: number
}

export interface LotteryRoomSnapshot extends LotterySettings {
  id: string
  title: string
  hostId: number
  hostName: string
  status: LotteryRoomStatus
  winners: LotteryWinner[]
  members: LotteryMember[]
  version: number
  serverTime: string
  nextDrawAt: string | null
  drawId: number
}
