const fromEnv = import.meta.env.VITE_WS_URL as string | undefined

const sameOrigin = (): string => {
  const origin = globalThis.location?.origin ?? ''
  return `${origin.replace(/^http/, 'ws')}/api/ws`
}

export const WS_URL = fromEnv ?? sameOrigin()
