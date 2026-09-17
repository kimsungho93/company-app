export type WalkingRoute = 'entry' | 'exit'

export type WalkingPose = {
  x: number
  z: number
  heading: number
  distance: number
}

export const WALKING_SPEED = 0.82
export const ROAD_WRAP_X = 46

const TURN_RADIUS = 0.7
const TURN_LENGTH = (TURN_RADIUS * Math.PI) / 2
const ENTRY_STRAIGHT = 42.05
const ENTRY_APPROACH = 8.85
const EXIT_APPROACH = 9.35
const EXIT_STRAIGHT = 36.05

export const walkingRouteLength = (route: WalkingRoute) =>
  route === 'entry'
    ? ENTRY_STRAIGHT + TURN_LENGTH + ENTRY_APPROACH
    : EXIT_APPROACH + TURN_LENGTH + EXIT_STRAIGHT

const wrap = (value: number, length: number) => ((value % length) + length) % length

export const sampleWalkingPose = (
  elapsedSeconds: number,
  startFraction: number,
  route: WalkingRoute,
  target: WalkingPose,
) => {
  const length = walkingRouteLength(route)
  const distance = wrap(elapsedSeconds * WALKING_SPEED + startFraction * length, length)
  target.distance = elapsedSeconds * WALKING_SPEED + startFraction * length

  if (route === 'entry') {
    if (distance < ENTRY_STRAIGHT) {
      target.x = -40 + distance
      target.z = 5.15
      target.heading = Math.PI / 2
    } else if (distance < ENTRY_STRAIGHT + TURN_LENGTH) {
      const angle = (distance - ENTRY_STRAIGHT) / TURN_RADIUS
      target.x = 2.05 + TURN_RADIUS * Math.sin(angle)
      target.z = 4.45 + TURN_RADIUS * Math.cos(angle)
      target.heading = Math.PI / 2 + angle
    } else {
      target.x = 2.75
      target.z = 4.45 - (distance - ENTRY_STRAIGHT - TURN_LENGTH)
      target.heading = Math.PI
    }
    return
  }

  if (distance < EXIT_APPROACH) {
    target.x = 3.25
    target.z = -4.4 + distance
    target.heading = 0
  } else if (distance < EXIT_APPROACH + TURN_LENGTH) {
    const angle = (distance - EXIT_APPROACH) / TURN_RADIUS
    target.x = 3.95 - TURN_RADIUS * Math.cos(angle)
    target.z = 4.95 + TURN_RADIUS * Math.sin(angle)
    target.heading = angle
  } else {
    target.x = 3.95 + distance - EXIT_APPROACH - TURN_LENGTH
    target.z = 5.65
    target.heading = Math.PI / 2
  }
}

export const gateOpenAmount = (nearestPersonDistance: number) => {
  const progress = Math.max(0, Math.min(1, (2.15 - nearestPersonDistance) / 0.95))
  return progress * progress * (3 - 2 * progress)
}

export const sampleCarX = (
  elapsedSeconds: number,
  startFraction: number,
  direction: 1 | -1,
  speed: number,
) =>
  direction *
  (wrap(elapsedSeconds * speed + startFraction * ROAD_WRAP_X * 2, ROAD_WRAP_X * 2) - ROAD_WRAP_X)
