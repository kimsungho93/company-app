export interface ChatPerson {
  userId: number
  name: string
}

export interface ChatMessage {
  id: string
  seq: number
  clientMessageId: string
  senderId: number
  senderName: string
  text: string
  sentAt: string
  readers: ChatPerson[]
}

export interface ChatDisplayMessage extends ChatMessage {
  delivery: 'sending' | 'sent' | 'failed'
  failure?: string
}

export type LotteryChatEvent =
  | { type: 'READY'; roomId: string }
  | { type: 'MESSAGE'; roomId: string; message: ChatMessage }
  | { type: 'ACK'; roomId: string; clientMessageId: string; message: ChatMessage }
  | { type: 'PAGE'; roomId: string; requestId: string; messages: ChatMessage[]; hasMore: boolean; oldestSeq: number; latestSeq: number; typing: ChatPerson[] }
  | { type: 'READ'; roomId: string; seqs: number[]; reader: ChatPerson }
  | { type: 'TYPING'; roomId: string; people: ChatPerson[] }
  | { type: 'ERROR'; roomId: string; requestId?: string; clientMessageId?: string; code: string; message: string }

export interface LotteryChatCommands {
  history: { requestId: string; beforeSeq?: number; query?: string; senderId?: number }
  send: { clientMessageId: string; text: string }
  read: { seqs: number[] }
  typing: { typing: boolean }
}
