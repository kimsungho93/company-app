import { describe, expect, it } from 'vitest'
import {
  gateOpenAmount,
  ROAD_WRAP_X,
  sampleCarX,
  sampleWalkingPose,
  WALKING_SPEED,
  walkingRouteLength,
  type WalkingPose,
  type WalkingRoute,
} from './campusMotion'

const poseAt = (elapsed: number, route: WalkingRoute, startFraction = 0): WalkingPose => {
  const pose = { x: 0, z: 0, heading: 0, distance: 0 }
  sampleWalkingPose(elapsed, startFraction, route, pose)
  return pose
}

describe('campus motion', () => {
  it.each(['entry', 'exit'] as const)(
    'keeps the %s walk continuous at every visible point and turns at walking speed',
    (route) => {
      const duration = walkingRouteLength(route) / WALKING_SPEED
      for (let time = 0; time < duration - 0.02; time += 0.02) {
        const before = poseAt(time, route)
        const after = poseAt(time + 0.02, route)
        const distance = Math.hypot(after.x - before.x, after.z - before.z)
        expect(distance).toBeGreaterThan(WALKING_SPEED * 0.0199)
        expect(distance).toBeLessThanOrEqual(WALKING_SPEED * 0.02001)
        expect(Math.abs(after.heading - before.heading)).toBeLessThan(0.024)
      }
    },
  )

  it('crosses the gate in separate lanes with fully open leaves for both directions', () => {
    for (const route of ['entry', 'exit'] as const) {
      const duration = walkingRouteLength(route) / WALKING_SPEED
      let crossedGate = false
      for (let time = 0; time < duration; time += 0.025) {
        const pose = poseAt(time, route)
        if (Math.abs(pose.z - 3.2) < 0.7) {
          crossedGate = true
          expect(pose.x).toBe(route === 'entry' ? 2.75 : 3.25)
          expect(pose.heading).toBe(route === 'entry' ? Math.PI : 0)
          expect(gateOpenAmount(Math.hypot(pose.x - 3, pose.z - 3.2))).toBe(1)
        }
      }
      expect(crossedGate).toBe(true)
    }
    expect(gateOpenAmount(2.15)).toBe(0)
    expect(gateOpenAmount(1.675)).toBeCloseTo(0.5)
    expect(gateOpenAmount(Infinity)).toBe(0)
  })

  it.each(['entry', 'exit'] as const)(
    'resets the %s route only between the factory interior and outside the scene',
    (route) => {
      const duration = walkingRouteLength(route) / WALKING_SPEED
      const before = poseAt(duration - 0.00001, route)
      const after = poseAt(duration + 0.00001, route)
      const concealed = (pose: WalkingPose) => Math.abs(pose.x) > 39 || pose.z < -4.3
      expect(concealed(before)).toBe(true)
      expect(concealed(after)).toBe(true)
      expect((route === 'entry' ? after : before).x).toBeCloseTo(route === 'entry' ? -40 : 40, 4)
    },
  )

  it('keeps all eight people separated over several complete loops', () => {
    const definitions: [WalkingRoute, number][] = [
      ['entry', 0.22],
      ['entry', 0.4],
      ['entry', 0.58],
      ['entry', 0.72],
      ['exit', 0.02],
      ['exit', 0.27],
      ['exit', 0.5],
      ['exit', 0.75],
    ]
    const initialView = definitions.map(([route, offset]) => poseAt(9, route, offset))
    expect(
      initialView.filter((pose) => Math.abs(pose.x) < 18 && pose.z > -1).length,
    ).toBeGreaterThanOrEqual(3)
    expect(initialView.some((pose) => Math.hypot(pose.x - 3, pose.z - 3.2) < 1)).toBe(true)
    for (let time = 0; time < 200; time += 0.05) {
      const poses = definitions.map(([route, offset]) => poseAt(time, route, offset))
      for (let first = 0; first < poses.length; first += 1) {
        for (let second = first + 1; second < poses.length; second += 1) {
          expect(
            Math.hypot(poses[first].x - poses[second].x, poses[first].z - poses[second].z),
          ).toBeGreaterThan(0.44)
        }
      }
    }
  })

  it('restores the same pose after skipped frames without advancing a simulation', () => {
    const sampled = { x: 0, z: 0, heading: 0, distance: 0 }
    for (let frame = 0; frame <= 600; frame += 1) {
      sampleWalkingPose(frame / 60, 0.9, 'entry', sampled)
    }
    expect(sampled).toEqual(poseAt(10, 'entry', 0.9))
    sampleWalkingPose(600, 0.9, 'entry', sampled)
    expect(sampled).toEqual(poseAt(600, 'entry', 0.9))
  })

  it.each([1, -1] as const)(
    'moves cars in direction %i and wraps beyond the scene',
    (direction) => {
      const speed = 3.05
      expect(
        sampleCarX(1, 0.2, direction, speed) - sampleCarX(0, 0.2, direction, speed),
      ).toBeCloseTo(direction * speed)
      for (let time = 0; time < 120; time += 0.02) {
        const before = sampleCarX(time, 0.2, direction, speed)
        const after = sampleCarX(time + 0.02, 0.2, direction, speed)
        expect(Math.abs(after)).toBeLessThanOrEqual(ROAD_WRAP_X)
        if (Math.abs(after - before) > 1) {
          expect(Math.abs(before)).toBeGreaterThan(45)
          expect(Math.abs(after)).toBeGreaterThan(45)
        } else {
          expect(after - before).toBeCloseTo(direction * speed * 0.02)
        }
      }
    },
  )
})
