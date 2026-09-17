import { describe, expect, it } from 'vitest'
import {
  CAPTURE_DURATION_MS,
  CHUTE_DURATION_MS,
  ROLL_DURATION_MS,
  WINNER_HOLD_MS,
} from '../../model/drawTiming'
import {
  ballRadius,
  CHUTE_END,
  drawnBallPosition,
  EXIT_DURATION_MS,
  exitingPosition,
  GATE_POSITION,
  GLOBE_CENTER_Y,
  GLOBE_RADIUS,
  restingPositions,
  swirlingPosition,
  TRAY_END,
} from './motion'

describe('lottery machine motion', () => {
  it.each([1, 13, 18, 19, 30, 31, 50])(
    'keeps all %i resting balls inside the drum without overlapping',
    (count) => {
      const positions = restingPositions(count)
      const radius = ballRadius(count)
      expect(positions).toHaveLength(count)
      for (const [index, position] of positions.entries()) {
        expect(
          Math.hypot(position[0], position[1] - GLOBE_CENTER_Y, position[2]) + radius,
        ).toBeLessThanOrEqual(GLOBE_RADIUS)
        for (const other of positions.slice(index + 1)) {
          expect(
            Math.hypot(position[0] - other[0], position[1] - other[1], position[2] - other[2]),
          ).toBeGreaterThanOrEqual(radius * 2)
        }
      }
    },
  )

  it('shows the same bounded mixing positions to viewers with the same server time', () => {
    for (let index = 0; index < 50; index += 1) {
      const position = swirlingPosition(index, 50, 7, 1_800_000_000_000)
      expect(position).toEqual(swirlingPosition(index, 50, 7, 1_800_000_000_000))
      expect(
        Math.hypot(position[0], position[1] - GLOBE_CENTER_Y, position[2]) + ballRadius(50),
      ).toBeLessThan(GLOBE_RADIUS)
    }
    expect(swirlingPosition(0, 13, 1, 1_800_000_000_000)).not.toEqual(
      swirlingPosition(0, 13, 2, 1_800_000_000_000),
    )
  })

  it('continues a revealed ball along its chute using elapsed server time, then removes it', () => {
    const from: [number, number, number] = [0.5, 1, 0.1]
    expect(exitingPosition(from, -1)).toBeNull()
    expect(exitingPosition(from, 0)).toEqual(from)
    expect(exitingPosition(from, CAPTURE_DURATION_MS)).toEqual(GATE_POSITION)
    expect(exitingPosition(from, CAPTURE_DURATION_MS + CHUTE_DURATION_MS)).toEqual(CHUTE_END)
    expect(exitingPosition(from, EXIT_DURATION_MS)).toBeNull()
    expect(exitingPosition(from, EXIT_DURATION_MS + 10_000)).toBeNull()
  })

  it('slows each ball onto the tray and holds it there before presenting the result', () => {
    const from: [number, number, number] = [0.5, 1, 0.1]
    const arrivesAt = CAPTURE_DURATION_MS + CHUTE_DURATION_MS + ROLL_DURATION_MS
    const before = exitingPosition(from, arrivesAt - 16)!
    expect(Math.hypot(...TRAY_END.map((value, axis) => value - before[axis]))).toBeLessThan(0.001)
    expect(exitingPosition(from, arrivesAt)).toEqual(TRAY_END)
    expect(exitingPosition(from, arrivesAt + WINNER_HOLD_MS - 1)).toEqual(TRAY_END)
    expect(exitingPosition(from, arrivesAt + WINNER_HOLD_MS)).toBeNull()
  })

  it('mixes briskly without jumping between successive frames', () => {
    const start = 1_800_000_000_000
    let distance = 0
    for (let index = 0; index < 13; index += 1) {
      for (let frame = 1; frame <= 60; frame += 1) {
        const previous = swirlingPosition(index, 13, 7, start + (frame - 1) * 16)
        const position = swirlingPosition(index, 13, 7, start + frame * 16)
        const step = Math.hypot(...position.map((value, axis) => value - previous[axis]))
        expect(step).toBeLessThan(ballRadius(13))
        distance += step
      }
    }
    expect(distance / 13).toBeGreaterThan(3)
  })

  it.each([1, 13, 31, 50])(
    'brings a selected ball to the gate inside the %i-ball drum before releasing it',
    (count) => {
      const drawnAt = 1_800_000_000_000
      for (let index = 0; index < count; index += 1) {
        for (let elapsed = 0; elapsed <= CAPTURE_DURATION_MS; elapsed += 25) {
          const position = drawnBallPosition(index, count, 7, drawnAt, drawnAt + elapsed)!
          expect(
            Math.hypot(position[0], position[1] - GLOBE_CENTER_Y, position[2]) + ballRadius(count),
          ).toBeLessThan(GLOBE_RADIUS)
        }
        expect(drawnBallPosition(index, count, 7, drawnAt, drawnAt + CAPTURE_DURATION_MS)).toEqual(
          GATE_POSITION,
        )
      }
    },
  )

  it('keeps the path continuous at the gate and at the tray', () => {
    const drawnAt = 1_800_000_000_000
    for (const boundary of [CAPTURE_DURATION_MS, CAPTURE_DURATION_MS + CHUTE_DURATION_MS]) {
      const before = drawnBallPosition(3, 13, 8, drawnAt, drawnAt + boundary - 1)!
      const after = drawnBallPosition(3, 13, 8, drawnAt, drawnAt + boundary + 1)!
      expect(Math.hypot(...after.map((value, axis) => value - before[axis]))).toBeLessThan(0.01)
    }
  })

  it('continues from the visible ball after a delayed event and still reaches the gate on time', () => {
    const drawnAt = 1_800_000_000_000
    const origin = { position: swirlingPosition(3, 13, 8, drawnAt + 240), startedAt: drawnAt + 240 }
    expect(drawnBallPosition(3, 13, 8, drawnAt, origin.startedAt, origin)).toEqual(origin.position)
    expect(drawnBallPosition(3, 13, 8, drawnAt, drawnAt + CAPTURE_DURATION_MS, origin)).toEqual(
      GATE_POSITION,
    )
    expect(drawnBallPosition(3, 13, 8, drawnAt, drawnAt + EXIT_DURATION_MS, origin)).toBeNull()
  })

  it('restores the current chute position for a viewer joining after capture', () => {
    const drawnAt = 1_800_000_000_000
    const now = drawnAt + CAPTURE_DURATION_MS + 350
    const canonical = drawnBallPosition(3, 13, 8, drawnAt, now)
    const lateOrigin = { position: [0, 0, 0] as [number, number, number], startedAt: now }
    expect(drawnBallPosition(3, 13, 8, drawnAt, now, lateOrigin)).toEqual(canonical)
    expect(canonical![0]).toBe(0)
    expect(canonical![1]).toBeLessThan(GATE_POSITION[1])
    expect(canonical![1]).toBeGreaterThan(CHUTE_END[1])
  })
})
