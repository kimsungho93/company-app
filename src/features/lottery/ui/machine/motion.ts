import { CAPTURE_DURATION_MS, CHUTE_DURATION_MS, ROLL_DURATION_MS, WINNER_EXIT_MS } from '../../model/drawTiming'

export const GLOBE_RADIUS = 1.48
export const GLOBE_CENTER_Y = 0.48
export const EXIT_DURATION_MS = WINNER_EXIT_MS

export type BallPosition = [number, number, number]
export type CaptureOrigin = { position: BallPosition; startedAt: number }

export const GATE_POSITION: BallPosition = [0, -0.60, 0.36]
export const CHUTE_ENTRY: BallPosition = [0, -0.91, 0.49]
export const CHUTE_END: BallPosition = [0, -1.46, 0.79]
export const TRAY_END: BallPosition = [0.88, -1.55, 1.02]

export const ballRadius = (count: number) => {
  return count > 30 ? 0.18 : count > 18 ? 0.22 : 0.27
}

export const restingPositions = (count: number, originalCount = count): BallPosition[] => {
  const radius = ballRadius(originalCount)
  const spacing = radius * 2.04
  const limit = GLOBE_RADIUS - radius - 0.07
  const slots: BallPosition[] = []

  for (let depth = 0; depth < 8; depth += 1) {
    const z = 0.18 - depth * spacing
    const plane: BallPosition[] = []
    for (let layer = 0; layer < 12; layer += 1) {
      const y = -limit + radius * 0.16 + layer * spacing * Math.sqrt(3) / 2
      if (y > limit) break
      for (let column = -6; column <= 6; column += 1) {
        const x = (column + (layer % 2) * 0.5) * spacing
        if (x * x + y * y + z * z <= limit * limit) {
          plane.push([x, y + GLOBE_CENTER_Y, z])
        }
      }
    }
    slots.push(...plane.sort((a, b) => a[1] - b[1] || a[0] - b[0]))
  }

  return slots.slice(0, count)
}

export const swirlingPosition = (index: number, count: number, drawId: number, serverNow: number): BallPosition => {
  const phase = index * 2.399963 + drawId * 0.73
  const time = serverNow / 1000
  const angle = time * (3.8 + (index % 4) * 0.28) + phase
  const latitude = Math.sin(time * (3.5 + (index % 3) * 0.23) + phase * 1.9) * 1.3
  const radius = (GLOBE_RADIUS - ballRadius(count) - 0.06) * (0.76 + 0.2 * Math.sin(time * 1.5 + phase))

  return [
    Math.cos(angle) * Math.cos(latitude) * radius,
    Math.sin(latitude) * radius + GLOBE_CENTER_Y,
    Math.sin(angle) * Math.cos(latitude) * radius,
  ]
}

export const interpolatePosition = (from: BallPosition, to: BallPosition, progress: number): BallPosition => {
  const t = Math.max(0, Math.min(1, progress))
  const eased = t * t * (3 - 2 * t)
  return [
    from[0] + (to[0] - from[0]) * eased,
    from[1] + (to[1] - from[1]) * eased,
    from[2] + (to[2] - from[2]) * eased,
  ]
}

const cubicPosition = (a: BallPosition, b: BallPosition, c: BallPosition, d: BallPosition, t: number): BallPosition => {
  const u = 1 - t
  return [0, 1, 2].map((axis) => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]) as BallPosition
}

const insideDrum = (position: BallPosition, count: number): BallPosition => {
  const distance = Math.hypot(position[0], position[1] - GLOBE_CENTER_Y, position[2])
  const scale = Math.min(1, (GLOBE_RADIUS - ballRadius(count) - 0.045) / distance)
  return [position[0] * scale, (position[1] - GLOBE_CENTER_Y) * scale + GLOBE_CENTER_Y, position[2] * scale]
}

export const chutePosition = (progress: number): BallPosition => cubicPosition(GATE_POSITION, CHUTE_ENTRY, [0, -1.29, 0.64], CHUTE_END, progress)

export const rollingPosition = (progress: number): BallPosition => cubicPosition(CHUTE_END, [0, -1.59, 0.88], [0.61, -1.55, 1.02], TRAY_END, progress)

export const exitingPosition = (from: BallPosition, elapsedMs: number, tangent: BallPosition = from): BallPosition | null => {
  if (elapsedMs >= EXIT_DURATION_MS || elapsedMs < 0) return null
  if (elapsedMs < CAPTURE_DURATION_MS) {
    return cubicPosition(from, tangent, [0, -0.16, 0.25], GATE_POSITION, elapsedMs / CAPTURE_DURATION_MS)
  }
  const chuteElapsed = elapsedMs - CAPTURE_DURATION_MS
  if (chuteElapsed < CHUTE_DURATION_MS) {
    return chutePosition(chuteElapsed / CHUTE_DURATION_MS)
  }
  const rollProgress = Math.min(1, (chuteElapsed - CHUTE_DURATION_MS) / ROLL_DURATION_MS)
  return rollingPosition(1 - (1 - rollProgress) ** 2)
}

export const drawnBallPosition = (index: number, count: number, drawId: number, drawnAt: number, serverNow: number, origin?: CaptureOrigin): BallPosition | null => {
  const captureEndsAt = drawnAt + CAPTURE_DURATION_MS
  const start = origin && origin.startedAt < captureEndsAt ? origin.startedAt : drawnAt
  const from = origin && start === origin.startedAt ? origin.position : swirlingPosition(index, count, drawId, drawnAt)
  const current = swirlingPosition(index, count, drawId, start)
  const previous = swirlingPosition(index, count, drawId, start - 16)
  const tangent = insideDrum(from.map((value, axis) => value + (current[axis] - previous[axis]) * 9) as BallPosition, count)
  const elapsed = serverNow < captureEndsAt
    ? (serverNow - start) / (captureEndsAt - start) * CAPTURE_DURATION_MS
    : serverNow - drawnAt
  return exitingPosition(from, elapsed, tangent)
}
