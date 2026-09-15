import type { StompConnection } from '@/shared/ws'
import type { LotteryChatCommands, LotteryChatEvent } from '../api/chatTypes'

export interface LotteryChatTransport {
  roomId: string
  isConnected: () => boolean
  subscribeConnection: (listener: () => void) => () => void
  subscribe: (listener: (event: LotteryChatEvent) => void) => () => void
  publish: <Command extends keyof LotteryChatCommands>(command: Command, body: LotteryChatCommands[Command]) => boolean
}

export const createLotteryChatTransport = (roomId: string) => {
  let connection: StompConnection | null = null
  let established = false
  let generation = 0
  let subscriptions: (() => void)[] = []
  const listeners = new Set<(event: LotteryChatEvent) => void>()
  const connectionListeners = new Set<() => void>()

  const disconnect = () => {
    generation += 1
    subscriptions.forEach((unsubscribe) => {
      try { unsubscribe() } catch { return }
    })
    subscriptions = []
    connection = null
    if (!established) return
    established = false
    connectionListeners.forEach((listener) => listener())
  }

  return {
    roomId,
    isConnected: () => established,
    subscribeConnection: (listener: () => void) => {
      connectionListeners.add(listener)
      return () => { connectionListeners.delete(listener) }
    },
    subscribe: (listener: (event: LotteryChatEvent) => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish: <Command extends keyof LotteryChatCommands>(command: Command, body: LotteryChatCommands[Command]) => {
      if (!connection || !established) return false
      try {
        connection.publish(`/app/lottery/rooms/${roomId}/chat/${command}`, body)
        return true
      } catch {
        return false
      }
    },
    connect: (ready: StompConnection) => {
      disconnect()
      const current = generation
      connection = ready
      const receive = (event: LotteryChatEvent, sessionReply = false) => {
        if (current !== generation || event.roomId !== roomId) return
        if (event.type === 'READY') {
          if (sessionReply && !established) {
            established = true
            connectionListeners.forEach((listener) => listener())
          }
          return
        }
        if (established) listeners.forEach((listener) => listener(event))
      }
      subscriptions = [
        ready.subscribe<LotteryChatEvent>(`/topic/lottery/rooms/${roomId}/chat`, receive),
        ready.subscribe<LotteryChatEvent>('/user/queue/lottery-chat', (event) => receive(event, true)),
      ]
    },
    disconnect,
  }
}
