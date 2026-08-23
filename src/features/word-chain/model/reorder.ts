export const moveTo = (order: number[], userId: number, index: number): number[] => {
  const from = order.indexOf(userId)
  if (from === -1) return order

  const to = Math.max(0, Math.min(order.length - 1, index))
  if (from === to) return order

  const next = order.slice()
  next.splice(from, 1)
  next.splice(to, 0, userId)

  return next
}

export const sameOrder = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index])

export const applyOrder = <T extends { userId: number }>(items: T[], order: number[]): T[] => {
  const known = new Set(order)
  const byId = new Map(items.map((item) => [item.userId, item]))

  return [
    ...order.map((id) => byId.get(id)).filter((item): item is T => item !== undefined),
    ...items.filter((item) => !known.has(item.userId)),
  ]
}
