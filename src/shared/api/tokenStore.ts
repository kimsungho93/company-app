let accessToken: string | null = null
let generation = 0

export const tokenStore = {
  get: (): string | null => accessToken,
  generation: (): number => generation,
  invalidate(): void { generation += 1 },
  set(token: string | null): void {
    accessToken = token
  },
  clear(): void {
    accessToken = null
    generation += 1
  },
}
