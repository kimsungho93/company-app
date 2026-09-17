import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { frameCampusCamera } from './campusRenderer'
import { ROAD_WRAP_X } from './campusMotion'

describe('campus camera framing', () => {
  it.each([0.65, 0.96, 1.35, 1.75, 2.22, 3.1])(
    'keeps actor wrap points outside the viewport at aspect %s',
    (aspect) => {
      const camera = new PerspectiveCamera(43, 1, 0.2, 1200)
      frameCampusCamera(camera, aspect)
      const endpoints = [
        { x: -40, z: 5.15, radius: 0.3 },
        { x: 40, z: 5.65, radius: 0.3 },
        ...[9, 11.6, 14.4, 17.2].flatMap((z) => [
          { x: -ROAD_WRAP_X, z, radius: 2.4 },
          { x: ROAD_WRAP_X, z, radius: 2.4 },
        ]),
      ]
      for (const endpoint of endpoints) {
        for (const dx of [-endpoint.radius, endpoint.radius]) {
          for (const dz of [-1, 1]) {
            const position = new Vector3(endpoint.x + dx, 1, endpoint.z + dz).project(camera)
            expect(Math.abs(position.x)).toBeGreaterThan(1.02)
          }
        }
      }
      const gate = new Vector3(3, 1, 3.2).project(camera)
      const sign = new Vector3(-3, 9.8, -0.45).project(camera)
      for (const point of [gate, sign]) {
        expect(Math.abs(point.x)).toBeLessThan(0.9)
        expect(Math.abs(point.y)).toBeLessThan(0.9)
      }
    },
  )
})
