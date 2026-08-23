import { Client } from '@stomp/stompjs'

export interface StompConnection {
  subscribe: <T,>(destination: string, onMessage: (body: T) => void) => () => void
  publish: (destination: string, body?: unknown) => void
  close: () => void
}

export interface ErrorReason {
  code: string
  message: string
}

export interface ConnectStompOptions {
  url: string
  token: string
  onConnect: (connection: StompConnection) => void
  onError: (reason?: ErrorReason) => void
}

const toReason = (body: string): ErrorReason | undefined => {
  try {
    const parsed = JSON.parse(body) as Partial<ErrorReason>
    return parsed.code && parsed.message
      ? { code: parsed.code, message: parsed.message }
      : undefined
  } catch {
    return undefined
  }
}

export const connectStomp = ({
  url,
  token,
  onConnect,
  onError,
}: ConnectStompOptions): StompConnection => {
  let leaving = false

  const client = new Client({
    brokerURL: url,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0,
    onConnect: () => onConnect(connection),
    onStompError: (frame) => onError(toReason(frame.body)),
    onWebSocketError: () => onError(),
    onWebSocketClose: () => {
      if (!leaving) onError()
    },
  })

  const connection: StompConnection = {
    subscribe: (destination, onMessage) => {
      const subscription = client.subscribe(destination, (message) =>
        onMessage(JSON.parse(message.body)),
      )
      return () => subscription.unsubscribe()
    },
    publish: (destination, body) =>
      client.publish(
        body === undefined
          ? { destination, body: '' }
          : {
              destination,
              body: JSON.stringify(body),
              headers: { 'content-type': 'application/json' },
            },
      ),
    close: () => {
      leaving = true
      void client.deactivate()
    },
  }

  client.activate()
  return connection
}
