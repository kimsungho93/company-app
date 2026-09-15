import { Client } from '@stomp/stompjs'
import { isSessionEndCode, sessionStore } from '../api/sessionStore'

export interface StompConnection {
  subscribe: <T,>(destination: string, onMessage: (body: T) => void) => () => void
  publish: (destination: string, body?: unknown) => void
  close: () => void
}

export interface ErrorReason { code: string; message: string }
export interface ConnectStompOptions {
  url: string
  token: string
  onConnect: (connection: StompConnection) => void
  onError: (reason?: ErrorReason) => void
}

const toReason = (body: string): ErrorReason | undefined => {
  try {
    const parsed = JSON.parse(body) as Partial<ErrorReason>
    return parsed.code && parsed.message ? { code: parsed.code, message: parsed.message } : undefined
  } catch {
    return undefined
  }
}

export const connectStomp = ({ url, token, onConnect, onError }: ConnectStompOptions): StompConnection => {
  let leaving = false
  let unsubscribe = () => undefined as void
  const client = new Client({
    brokerURL: url,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0,
    onConnect: () => { if (!leaving) onConnect(connection) },
    onStompError: (frame) => {
      if (leaving) return
      const reason = toReason(frame.body)
      if (isSessionEndCode(reason?.code)) sessionStore.end(reason.code)
      else onError(reason)
    },
    onWebSocketError: () => { if (!leaving) onError() },
    onWebSocketClose: (event) => {
      if (leaving) return
      if (event?.code === 4001 && isSessionEndCode(event.reason)) sessionStore.end(event.reason)
      else onError()
    },
  })

  const connection: StompConnection = {
    subscribe: (destination, onMessage) => {
      if (leaving) return () => undefined
      const subscription = client.subscribe(destination, (message) => {
        if (!leaving) onMessage(JSON.parse(message.body))
      })
      return () => subscription.unsubscribe()
    },
    publish: (destination, body) => {
      if (leaving) return
      client.publish(body === undefined
        ? { destination, body: '' }
        : { destination, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
    },
    close: () => {
      if (leaving) return
      leaving = true
      unsubscribe()
      void client.deactivate()
    },
  }
  unsubscribe = sessionStore.onEvent(() => connection.close())
  if (sessionStore.get().ended) connection.close()
  else client.activate()
  return connection
}
