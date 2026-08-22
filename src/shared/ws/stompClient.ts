import { Client } from '@stomp/stompjs'

export interface StompConnection {
  subscribe: <T,>(destination: string, onMessage: (body: T) => void) => () => void
  publish: (destination: string, body?: unknown) => void
  close: () => void
}

export interface ConnectStompOptions {
  url: string
  token: string
  onConnect: (connection: StompConnection) => void
  onError: () => void
}

export const connectStomp = ({
  url,
  token,
  onConnect,
  onError,
}: ConnectStompOptions): StompConnection => {
  const client = new Client({
    brokerURL: url,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0,
    onConnect: () => onConnect(connection),
    onStompError: onError,
    onWebSocketError: onError,
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
    close: () => void client.deactivate(),
  }

  client.activate()
  return connection
}
