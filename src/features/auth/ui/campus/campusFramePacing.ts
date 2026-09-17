const MINIMUM_INTERVAL = 1000 / 30

export const createCampusFramePacing = () => {
  let startedAt: number | null = null
  let renderCost = 0
  let interval = MINIMUM_INTERVAL

  return {
    get interval() {
      return interval
    },
    submitted: (now: number) => {
      startedAt = now
    },
    completed: (now: number) => {
      if (startedAt === null) return
      const duration = Math.max(0, now - startedAt)
      startedAt = null
      renderCost = renderCost ? renderCost * 0.7 + duration * 0.3 : duration
      interval = Math.max(MINIMUM_INTERVAL, Math.min(1000, renderCost * 1.3))
    },
    reset: () => {
      startedAt = null
      renderCost = 0
      interval = MINIMUM_INTERVAL
    },
  }
}
