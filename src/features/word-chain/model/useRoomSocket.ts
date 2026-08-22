import { useEffect, useRef, useState } from 'react'
import { reissueOnce, tokenStore } from '@/shared/api'
import { WS_URL, connectStomp } from '@/shared/ws'
import type { StompConnection } from '@/shared/ws'
import type { Avatar, RoomState } from '../api/types'

export interface RoomActions {
  avatar: (avatar: Avatar) => void
  ready: (ready: boolean) => void
  transfer: (userId: number) => void
  start: () => void
  leave: () => void
}

export interface RoomSocket {
  room: RoomState | null
  error: string | null
  disconnected: boolean
  send: RoomActions
}

export const useRoomSocket = (roomId: number): RoomSocket => {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const connectionRef = useRef<StompConnection | null>(null)

  useEffect(() => {
    let closed = false

    const open = async () => {
      await reissueOnce()
      if (closed) return

      const connection = connectStomp({
        url: WS_URL,
        token: tokenStore.get() ?? '',
        onConnect: (ready) => {
          ready.subscribe<RoomState>(`/topic/rooms/${roomId}`, setRoom)
          ready.subscribe<{ message: string }>('/user/queue/errors', (body) =>
            setError(body.message),
          )
          ready.publish(`/app/rooms/${roomId}/enter`)
        },
        onError: () => setDisconnected(true),
      })

      connectionRef.current = connection
      if (closed) connection.close()
    }

    void open()

    return () => {
      closed = true
      connectionRef.current?.close()
      connectionRef.current = null
    }
  }, [roomId])

  const publish = (suffix: string, body?: unknown) =>
    connectionRef.current?.publish(`/app/rooms/${roomId}/${suffix}`, body)

  return {
    room,
    error,
    disconnected,
    send: {
      avatar: (avatar) => publish('avatar', { avatar }),
      ready: (ready) => publish('ready', { ready }),
      transfer: (userId) => publish('transfer', { userId }),
      start: () => publish('start'),
      leave: () => publish('leave'),
    },
  }
}
