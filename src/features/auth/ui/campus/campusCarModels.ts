import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Point = [number, number, number]
type BodySection = [number, number, number, number]

export type CarSurfaces = {
  paint: THREE.Material
  glass: THREE.Material
  rubber: THREE.Material
  chrome: THREE.Material
  headlight: THREE.Material
  taillight: THREE.Material
  plate: THREE.Material
}

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Point = [0, 0, 0],
) => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const box = (
  parent: THREE.Object3D,
  material: THREE.Material,
  size: Point,
  position: Point,
  radius = 0.012,
) =>
  addMesh(
    parent,
    Math.min(...size) < 0.025
      ? new THREE.BoxGeometry(...size)
      : new RoundedBoxGeometry(...size, 1, radius),
    material,
    position,
  )

const curve = (
  parent: THREE.Object3D,
  material: THREE.Material,
  points: Point[],
  radius: number,
  segments = 20,
) =>
  addMesh(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
      segments,
      radius,
      3,
      false,
    ),
    material,
  )

const surface = (
  rows: number,
  columns: number,
  sample: (row: number, column: number) => Point,
  reverse = false,
) => {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      positions.push(...sample(row / rows, column / columns))
      uvs.push(column / columns, row / rows)
      if (row === rows || column === columns) continue
      const a = row * (columns + 1) + column
      const b = a + 1
      const c = a + columns + 1
      const d = c + 1
      indices.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const patch = (
  corners: [Point, Point, Point, Point],
  bulge: Point = [0, 0, 0],
  reverse = false,
  rows = 10,
  columns = 10,
) =>
  surface(
    rows,
    columns,
    (v, u) => {
      const shape = Math.sin(u * Math.PI) * Math.sin(v * Math.PI)
      return [0, 1, 2].map(
        (axis) =>
          THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(corners[0][axis], corners[1][axis], u),
            THREE.MathUtils.lerp(corners[2][axis], corners[3][axis], u),
            v,
          ) +
          bulge[axis] * shape,
      ) as Point
    },
    reverse,
  )

const batch = (parent: THREE.Group) => {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>()
  for (const child of [...parent.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue
    child.updateMatrix()
    const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
    geometry.applyMatrix4(child.matrix)
    for (const attribute of Object.keys(geometry.attributes)) {
      if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute)
    }
    const group = byMaterial.get(child.material) ?? []
    group.push(geometry)
    byMaterial.set(child.material, group)
    child.geometry.dispose()
    parent.remove(child)
  }
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries)
    if (merged) addMesh(parent, merged, material)
    for (const geometry of geometries) geometry.dispose()
  }
}

const sedanSections: BodySection[] = [
  [-2.27, 0.7, 0.65, 0.68],
  [-2.13, 0.8, 0.79, 0.82],
  [-1.74, 0.85, 0.9, 0.95],
  [-1.31, 0.866, 0.935, 0.99],
  [-0.62, 0.843, 0.949, 1.005],
  [0.48, 0.848, 0.943, 1.002],
  [1.31, 0.87, 0.873, 0.955],
  [1.88, 0.809, 0.803, 0.891],
  [2.19, 0.765, 0.732, 0.796],
  [2.28, 0.694, 0.689, 0.743],
]

const suvSections: BodySection[] = [
  [-2.2, 0.753, 0.91, 0.965],
  [-2.05, 0.858, 1.05, 1.12],
  [-1.48, 0.897, 1.101, 1.158],
  [-0.76, 0.878, 1.105, 1.172],
  [0.53, 0.871, 1.059, 1.148],
  [1.31, 0.898, 0.99, 1.108],
  [1.85, 0.849, 0.91, 1.035],
  [2.12, 0.813, 0.857, 0.96],
  [2.23, 0.72, 0.817, 0.899],
]

const bodyAt = (sections: BodySection[], x: number) => {
  const next = Math.max(
    1,
    sections.findIndex((section) => section[0] >= x),
  )
  const index = x >= sections.at(-1)![0] ? sections.length - 1 : next
  const start = sections[index - 1]
  const end = sections[index]
  const before = sections[Math.max(0, index - 2)]
  const after = sections[Math.min(sections.length - 1, index + 1)]
  const t = THREE.MathUtils.clamp((x - start[0]) / (end[0] - start[0]), 0, 1)
  const t2 = t * t
  const t3 = t2 * t
  return [1, 2, 3].map((axis) => {
    const span = end[0] - start[0]
    const firstSlope = ((end[axis] - before[axis]) / (end[0] - before[0])) * span
    const lastSlope = ((after[axis] - start[axis]) / (after[0] - start[0])) * span
    return (
      (2 * t3 - 3 * t2 + 1) * start[axis] +
      (t3 - 2 * t2 + t) * firstSlope +
      (-2 * t3 + 3 * t2) * end[axis] +
      (t3 - t2) * lastSlope
    )
  }) as Point
}

const wheelArchHeight = (x: number, radius: number) => {
  const distance = Math.min(Math.abs(x - 1.31), Math.abs(x + 1.31))
  if (distance >= radius) return 0.29
  return 0.345 + Math.sqrt(radius * radius - distance * distance)
}

const addBody = (parent: THREE.Group, surfaces: CarSurfaces, suv: boolean) => {
  const sections = suv ? suvSections : sedanSections
  const firstX = sections[0][0]
  const lastX = sections.at(-1)![0]
  const archRadius = suv ? 0.416 : 0.395
  const samples = new Set<number>([firstX, lastX])
  for (let index = 0; index <= 26; index += 1) {
    samples.add(THREE.MathUtils.lerp(firstX, lastX, index / 26))
  }
  for (const wheelX of [-1.31, 1.31]) {
    for (let index = 0; index <= 18; index += 1) {
      samples.add(wheelX + Math.cos((index / 18) * Math.PI) * archRadius)
    }
  }
  const xs = [...samples].sort((a, b) => a - b)
  const sampleX = (row: number) => xs[Math.round(row * (xs.length - 1))]
  const upperBody = surface(xs.length - 1, 12, (row, column) => {
    const x = sampleX(row)
    const [width, shoulder, crown] = bodyAt(sections, x)
    const angle = (column - 0.5) * Math.PI
    return [x, shoulder + (crown - shoulder) * Math.cos(angle), width * Math.sin(angle)]
  })
  addMesh(parent, upperBody, surfaces.paint)
  for (const side of [-1, 1]) {
    const sideBody = surface(
      xs.length - 1,
      5,
      (row, height) => {
        const x = sampleX(row)
        const [width, shoulder] = bodyAt(sections, x)
        const lower = wheelArchHeight(x, archRadius)
        const y = THREE.MathUtils.lerp(lower, shoulder, height)
        const curvature = Math.sin(height * Math.PI) * 0.02 - (1 - height) ** 2 * 0.036
        return [x, y, side * (width + curvature)]
      },
      side === 1,
    )
    const upperNormals = upperBody.getAttribute('normal')
    const sideNormals = sideBody.getAttribute('normal')
    for (let row = 0; row < xs.length; row += 1) {
      const upperIndex = row * 13 + (side < 0 ? 0 : 12)
      const sideIndex = row * 6 + 5
      const joinedNormal = new THREE.Vector3().fromBufferAttribute(upperNormals, upperIndex)
      joinedNormal.add(new THREE.Vector3().fromBufferAttribute(sideNormals, sideIndex)).normalize()
      upperNormals.setXYZ(upperIndex, joinedNormal.x, joinedNormal.y, joinedNormal.z)
      sideNormals.setXYZ(sideIndex, joinedNormal.x, joinedNormal.y, joinedNormal.z)
    }
    addMesh(parent, sideBody, surfaces.paint)
    for (const wheelX of [-1.31, 1.31]) {
      addMesh(
        parent,
        surface(
          24,
          2,
          (around, depth) => {
            const angle = around * Math.PI
            const x = wheelX + Math.cos(angle) * archRadius
            const y = 0.345 + Math.sin(angle) * archRadius
            const [width] = bodyAt(sections, x)
            return [x, y, side * (width - 0.036 - depth * 0.14)]
          },
          side === 1,
        ),
        surfaces.rubber,
      )
      if (suv) {
        const points: Point[] = []
        for (let segment = 0; segment <= 16; segment += 1) {
          const angle = (segment / 16) * Math.PI
          const x = wheelX + Math.cos(angle) * (archRadius + 0.018)
          const [width] = bodyAt(sections, x)
          points.push([x, 0.345 + Math.sin(angle) * (archRadius + 0.018), side * (width - 0.011)])
        }
        curve(parent, surfaces.rubber, points, 0.023, 24)
      }
    }
    const z = side * (suv ? 0.852 : 0.814)
    box(parent, suv ? surfaces.rubber : surfaces.paint, [1.775, 0.084, 0.073], [0, 0.313, z], 0.022)
  }
  for (const end of [-1, 1]) {
    const x = end < 0 ? firstX : lastX
    const [width, shoulder, crown] = bodyAt(sections, x)
    addMesh(
      parent,
      surface(
        8,
        16,
        (height, across) => {
          const side = across * 2 - 1
          const top = shoulder + (crown - shoulder) * Math.sqrt(1 - side * side)
          return [
            x + end * Math.sin(height * Math.PI) * 0.027,
            THREE.MathUtils.lerp(0.3, top, height),
            side * width,
          ]
        },
        end > 0,
      ),
      surfaces.paint,
    )
  }
  box(parent, surfaces.rubber, [4.1, 0.055, 1.26], [0, 0.27, 0], 0.02)
}

const addCabin = (parent: THREE.Group, surfaces: CarSurfaces, suv: boolean) => {
  const roofRearX = suv ? -1.235 : -0.73
  const roofFrontX = suv ? 0.355 : 0.34
  const roofY = suv ? 1.665 : 1.447
  const baseRearX = suv ? -1.86 : -1.445
  const baseFrontX = 1.115
  const baseY = suv ? 1.12 : 0.985
  const roofWidth = suv ? 0.655 : 0.611
  const baseWidth = suv ? 0.815 : 0.79
  addMesh(
    parent,
    surface(16, 12, (along, across) => {
      const side = across * 2 - 1
      return [
        THREE.MathUtils.lerp(roofRearX, roofFrontX, along),
        roofY + Math.sin(along * Math.PI) * 0.04 - Math.pow(side, 2) * 0.032,
        side * (roofWidth + Math.sin(along * Math.PI) * 0.012),
      ]
    }),
    surfaces.paint,
  )
  const windscreen = patch(
    [
      [baseFrontX, baseY, -baseWidth],
      [baseFrontX, baseY, baseWidth],
      [roofFrontX, roofY - 0.015, -roofWidth],
      [roofFrontX, roofY - 0.015, roofWidth],
    ],
    [0.047, 0.021, 0],
    true,
  )
  addMesh(parent, windscreen, surfaces.glass)
  addMesh(
    parent,
    patch(
      [
        [roofRearX, roofY - 0.015, -roofWidth],
        [roofRearX, roofY - 0.015, roofWidth],
        [baseRearX, baseY + 0.015, -baseWidth],
        [baseRearX, baseY + 0.015, baseWidth],
      ],
      [-0.024, 0.03, 0],
      true,
    ),
    surfaces.glass,
  )
  for (const side of [-1, 1]) {
    const rearBottom: Point = [baseRearX + 0.155, baseY + 0.016, side * baseWidth]
    const frontBottom: Point = [baseFrontX - 0.069, baseY + 0.012, side * baseWidth]
    const rearTop: Point = [roofRearX + 0.06, roofY - 0.047, side * (roofWidth + 0.008)]
    const frontTop: Point = [roofFrontX - 0.046, roofY - 0.047, side * (roofWidth + 0.008)]
    addMesh(
      parent,
      surface(
        16,
        2,
        (along, height) => {
          const x = THREE.MathUtils.lerp(rearTop[0], frontTop[0], along)
          const roofFraction = (x - roofRearX) / (roofFrontX - roofRearX)
          const camber = Math.sin(roofFraction * Math.PI)
          return [
            x,
            THREE.MathUtils.lerp(roofY - 0.047, roofY + camber * 0.04 - 0.032, height),
            side * THREE.MathUtils.lerp(roofWidth + 0.008, roofWidth + camber * 0.012, height),
          ]
        },
        side > 0,
      ),
      surfaces.paint,
    )
    addMesh(
      parent,
      patch([rearBottom, frontBottom, rearTop, frontTop], [0, 0, side * 0.015], side < 0),
      surfaces.glass,
    )
    for (const [start, end] of [
      [rearBottom, rearTop],
      [rearTop, frontTop],
      [frontTop, frontBottom],
    ]) {
      curve(parent, surfaces.chrome, [start, end], 0.012, 8)
    }
    curve(
      parent,
      surfaces.chrome,
      [rearBottom, [0, baseY + 0.01, side * (baseWidth + 0.005)], frontBottom],
      0.009,
    )
    curve(
      parent,
      surfaces.paint,
      [
        [baseFrontX + 0.014, baseY - 0.005, side * (baseWidth + 0.008)],
        [0.74, (baseY + roofY) / 2, side * ((baseWidth + roofWidth) / 2 + 0.016)],
        [roofFrontX, roofY - 0.014, side * roofWidth],
      ],
      0.027,
    )
    addMesh(
      parent,
      patch(
        [
          [baseRearX - 0.015, baseY - 0.012, side * baseWidth],
          rearBottom,
          [roofRearX - 0.035, roofY - 0.02, side * roofWidth],
          rearTop,
        ],
        [0, 0, side * 0.012],
        side < 0,
        8,
        3,
      ),
      surfaces.paint,
    )
    curve(
      parent,
      surfaces.paint,
      [
        [baseRearX - 0.014, baseY, side * baseWidth],
        [roofRearX, roofY - 0.013, side * roofWidth],
      ],
      0.027,
    )
    const pillarBottom: Point = [-0.235, baseY + 0.007, side * (baseWidth + 0.012)]
    const pillarTop: Point = [-0.32, roofY - 0.043, side * (roofWidth + 0.018)]
    addMesh(
      parent,
      patch(
        [
          [pillarBottom[0] - 0.042, pillarBottom[1], pillarBottom[2]],
          [pillarBottom[0] + 0.042, pillarBottom[1], pillarBottom[2]],
          [pillarTop[0] - 0.042, pillarTop[1], pillarTop[2]],
          [pillarTop[0] + 0.042, pillarTop[1], pillarTop[2]],
        ],
        [0, 0, side * 0.006],
        side < 0,
        4,
        2,
      ),
      surfaces.rubber,
    )
    if (suv) {
      curve(
        parent,
        surfaces.rubber,
        [
          [-1.3, baseY + 0.012, side * baseWidth],
          [-0.91, roofY - 0.048, side * roofWidth],
        ],
        0.018,
      )
      curve(
        parent,
        surfaces.chrome,
        [
          [roofRearX + 0.05, roofY + 0.035, side * 0.51],
          [-1, roofY + 0.097, side * 0.51],
          [0.06, roofY + 0.097, side * 0.51],
          [roofFrontX - 0.1, roofY + 0.035, side * 0.51],
        ],
        0.023,
      )
    }
    const mirrorArm = box(
      parent,
      surfaces.rubber,
      [0.14, 0.043, 0.16],
      [0.825, baseY + 0.046, side * 0.815],
      0.018,
    )
    mirrorArm.rotation.y = side * 0.15
    const mirror = addMesh(parent, new THREE.SphereGeometry(1, 12, 8), surfaces.paint, [
      0.77,
      baseY + 0.075,
      side * 0.936,
    ])
    mirror.scale.set(0.148, 0.071, 0.109)
    const mirrorGlass = addMesh(parent, new THREE.SphereGeometry(1, 10, 6), surfaces.chrome, [
      0.67,
      baseY + 0.075,
      side * 0.938,
    ])
    mirrorGlass.scale.set(0.024, 0.051, 0.085)
  }
  for (const side of [-1, 1]) {
    curve(
      parent,
      surfaces.rubber,
      [
        [0.99, baseY + 0.023, side * 0.12],
        [0.932, baseY + 0.067, side * 0.42],
        [0.918, baseY + 0.075, side * 0.57],
      ],
      0.006,
      10,
    )
  }
}

const addSideDetails = (parent: THREE.Group, surfaces: CarSurfaces, suv: boolean) => {
  const sections = suv ? suvSections : sedanSections
  const belt = suv ? 1.052 : 0.902
  for (const side of [-1, 1]) {
    const bodyPoint = (x: number, y: number): Point => {
      const [width, shoulder] = bodyAt(sections, x)
      const lower = wheelArchHeight(x, suv ? 0.416 : 0.395)
      const fraction = THREE.MathUtils.clamp((y - lower) / (shoulder - lower), 0, 1)
      return [
        x,
        y,
        side * (width + Math.sin(fraction * Math.PI) * 0.02 - (1 - fraction) ** 2 * 0.036 + 0.002),
      ]
    }
    for (const x of [-0.29, 0.955]) {
      curve(
        parent,
        surfaces.rubber,
        [
          bodyPoint(x - 0.045, belt),
          bodyPoint(x - 0.025, 0.66),
          bodyPoint(x - 0.055, 0.43),
          bodyPoint(x - 0.135, 0.36),
        ],
        0.0028,
        14,
      )
    }
    curve(
      parent,
      surfaces.rubber,
      [
        bodyPoint(-1.24, belt),
        bodyPoint(-0.91, 0.68),
        bodyPoint(-0.865, 0.44),
        bodyPoint(-0.78, 0.36),
      ],
      0.0028,
      14,
    )
    curve(
      parent,
      surfaces.chrome,
      [bodyPoint(-0.79, 0.362), bodyPoint(0, 0.346), bodyPoint(0.77, 0.362)],
      suv ? 0.012 : 0.005,
      14,
    )
    for (const x of [-0.825, 0.25]) {
      const position = bodyPoint(x, belt - 0.071)
      box(parent, surfaces.rubber, [0.188, 0.027, 0.006], position, 0.007)
      box(
        parent,
        surfaces.chrome,
        [0.153, 0.022, 0.026],
        [position[0], position[1] + 0.004, position[2] + side * 0.015],
        0.008,
      )
    }
    const fuel = bodyPoint(-1.635, suv ? 0.99 : 0.845)
    curve(
      parent,
      surfaces.rubber,
      [
        [fuel[0] - 0.073, fuel[1] - 0.046, fuel[2]],
        [fuel[0] + 0.065, fuel[1] - 0.046, fuel[2]],
        [fuel[0] + 0.073, fuel[1] + 0.057, fuel[2]],
        [fuel[0] - 0.065, fuel[1] + 0.06, fuel[2]],
        [fuel[0] - 0.073, fuel[1] - 0.046, fuel[2]],
      ],
      0.0024,
      20,
    )
  }
}

const faceDisc = (
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  depth: number,
  position: Point,
  segments = 20,
) => {
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
    position,
  )
  result.rotation.z = Math.PI / 2
  return result
}

const addLightsAndGrilles = (parent: THREE.Group, surfaces: CarSurfaces, suv: boolean) => {
  const sections = suv ? suvSections : sedanSections
  const hoodHeight = (x: number, z: number) => {
    const [width, shoulder, crown] = bodyAt(sections, x)
    return shoulder + (crown - shoulder) * Math.sqrt(Math.max(0, 1 - (z / width) ** 2))
  }
  const bodySurfaceX = (y: number, z: number, end: 1 | -1 = 1) => {
    const edgeX = end === 1 ? sections.at(-1)![0] : sections[0][0]
    const [edgeWidth] = bodyAt(sections, edgeX)
    if (Math.abs(z) <= edgeWidth && y <= hoodHeight(edgeX, z)) return edgeX + end * 0.03
    let lower = 1.5
    let upper = Math.abs(edgeX)
    for (let step = 0; step < 18; step += 1) {
      const middle = (lower + upper) / 2
      const [width] = bodyAt(sections, middle * end)
      if (width >= Math.abs(z) && hoodHeight(middle * end, z) >= y) lower = middle
      else upper = middle
    }
    return lower * end
  }
  const lampPoint = (y: number, z: number, elevation = 0.018): Point => [
    bodySurfaceX(y, z) + elevation,
    y,
    z,
  ]
  const lampNormal = (y: number, z: number) =>
    new THREE.Vector3(
      1,
      -(bodySurfaceX(y + 0.005, z) - bodySurfaceX(y - 0.005, z)) / 0.01,
      -(bodySurfaceX(y, z + 0.005) - bodySurfaceX(y, z - 0.005)) / 0.01,
    ).normalize()
  const frontX = suv ? 2.238 : 2.288
  const grilleY = suv ? 0.81 : 0.676
  const headY = suv ? 0.93 : 0.765
  box(
    parent,
    surfaces.rubber,
    [0.085, suv ? 0.19 : 0.075, suv ? 0.79 : 0.92],
    [frontX - 0.035, grilleY, 0],
    0.028,
  )
  for (const offset of [-1, 1]) {
    curve(
      parent,
      surfaces.chrome,
      [
        [frontX + 0.006, grilleY + offset * (suv ? 0.09 : 0.034), -0.383],
        [frontX + 0.027, grilleY + offset * (suv ? 0.081 : 0.028), 0],
        [frontX + 0.006, grilleY + offset * (suv ? 0.09 : 0.034), 0.383],
      ],
      0.009,
      18,
    )
  }
  if (suv) {
    for (let index = 0; index < 9; index += 1) {
      box(
        parent,
        surfaces.chrome,
        [0.008, 0.008, 0.68],
        [frontX + 0.013, grilleY - 0.061 + index * 0.015, 0],
        0.002,
      )
    }
  }
  const badge = faceDisc(parent, surfaces.chrome, suv ? 0.047 : 0.052, 0.012, [
    frontX + 0.045,
    grilleY + 0.008,
    0,
  ])
  badge.scale.z = 1.65
  const badgeInner = faceDisc(parent, surfaces.rubber, suv ? 0.034 : 0.038, 0.013, [
    frontX + 0.052,
    grilleY + 0.008,
    0,
  ])
  badgeInner.scale.z = 1.65
  box(
    parent,
    surfaces.rubber,
    [0.068, suv ? 0.136 : 0.165, suv ? 1.012 : 1.043],
    [frontX + 0.025, 0.437, 0],
    0.029,
  )
  for (let index = 0; index < 4; index += 1) {
    box(
      parent,
      surfaces.chrome,
      [0.014, 0.008, 0.951 - Math.abs(index - 1.5) * 0.061],
      [frontX + 0.064, 0.38 + index * 0.033, 0],
      0.003,
    )
  }
  for (const side of [-1, 1]) {
    const innerZ = side * 0.408
    const outerZ = side * (suv ? 0.797 : 0.779)
    const corners: [Point, Point, Point, Point] = [
      [0, headY - 0.055, innerZ],
      [0, headY + 0.005, outerZ],
      [0, headY + 0.08, innerZ],
      [0, headY + 0.11, outerZ * 0.99],
    ]
    addMesh(
      parent,
      surface(
        6,
        10,
        (v, u) => {
          const y = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(corners[0][1], corners[1][1], u),
            THREE.MathUtils.lerp(corners[2][1], corners[3][1], u),
            v,
          )
          const z = THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(corners[0][2], corners[1][2], u),
            THREE.MathUtils.lerp(corners[2][2], corners[3][2], u),
            v,
          )
          return lampPoint(y, z)
        },
        side > 0,
      ),
      surfaces.glass,
    )
    for (const [start, end] of [
      [corners[0], corners[1]],
      [corners[1], corners[3]],
      [corners[3], corners[2]],
      [corners[2], corners[0]],
    ]) {
      const edge: Point[] = []
      for (let step = 0; step <= 6; step += 1) {
        edge.push(
          lampPoint(
            THREE.MathUtils.lerp(start[1], end[1], step / 6),
            THREE.MathUtils.lerp(start[2], end[2], step / 6),
            0.018,
          ),
        )
      }
      curve(parent, surfaces.chrome, edge, 0.0045, 6)
    }
    for (const [index, z] of [0.474, 0.625].entries()) {
      const lampY = headY + (index === 0 ? 0.011 : 0.045)
      const position = new THREE.Vector3(...lampPoint(lampY, side * z, 0.021))
      const normal = lampNormal(lampY, side * z)
      const layers: [THREE.Material, number, number][] = [
        [surfaces.chrome, index ? 0.039 : 0.048, 0],
        [surfaces.rubber, index ? 0.029 : 0.037, 0.006],
        [surfaces.headlight, index ? 0.019 : 0.027, 0.012],
      ]
      for (const [material, radius, offset] of layers) {
        const center = position.clone().addScaledVector(normal, offset)
        const lens = addMesh(
          parent,
          new THREE.CylinderGeometry(radius, radius, 0.01, 18),
          material,
          center.toArray() as Point,
        )
        lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
      }
    }
    curve(
      parent,
      surfaces.headlight,
      [
        lampPoint(headY - 0.046, side * 0.433, 0.025),
        lampPoint(headY - 0.022, side * 0.611, 0.025),
        lampPoint(headY + 0.009, side * 0.755, 0.025),
      ],
      0.006,
      16,
    )
    const fogX = frontX + 0.016
    box(parent, surfaces.rubber, [0.076, 0.124, 0.218], [fogX, 0.459, side * 0.672], 0.04)
    faceDisc(parent, surfaces.chrome, 0.044, 0.015, [fogX + 0.046, 0.444, side * 0.673], 18)
    faceDisc(parent, surfaces.headlight, 0.031, 0.018, [fogX + 0.057, 0.444, side * 0.673], 18)
    curve(
      parent,
      surfaces.chrome,
      [
        [fogX + 0.035, 0.521, side * 0.566],
        [fogX + 0.042, 0.534, side * 0.663],
        [fogX + 0.025, 0.514, side * 0.771],
      ],
      0.01,
      12,
    )
    const rearX = suv ? -2.208 : -2.283
    const rearY = suv ? 0.987 : 0.77
    const rearLamp = patch(
      [
        [rearX, rearY - 0.075, side * 0.4],
        [rearX + 0.21, rearY - 0.006, side * 0.813],
        [rearX + 0.018, rearY + 0.022, side * 0.4],
        [rearX + 0.37, rearY + 0.105, side * 0.825],
      ],
      [0, 0, side * 0.017],
      side < 0,
      4,
      8,
    )
    const rearVertices = rearLamp.getAttribute('position')
    for (let index = 0; index < rearVertices.count; index += 1) {
      const y = rearVertices.getY(index)
      const z = rearVertices.getZ(index)
      rearVertices.setX(index, bodySurfaceX(y, z, -1) - 0.018)
    }
    rearLamp.computeVertexNormals()
    addMesh(parent, rearLamp, surfaces.taillight)
    const reverseStrip: Point[] = []
    for (let step = 0; step <= 10; step += 1) {
      const y = rearY - 0.016 + (step / 10) * 0.058
      const z = side * (0.42 + (step / 10) * 0.344)
      reverseStrip.push([bodySurfaceX(y, z, -1) - 0.027, y, z])
    }
    curve(parent, surfaces.headlight, reverseStrip, 0.006, 12)
    box(
      parent,
      surfaces.taillight,
      [0.018, 0.025, 0.169],
      [rearX + 0.044, 0.377, side * 0.66],
      0.007,
    )
    const exhaust = faceDisc(
      parent,
      surfaces.chrome,
      suv ? 0.039 : 0.027,
      0.078,
      [rearX + 0.093, 0.277, side * 0.588],
      16,
    )
    exhaust.scale.z = 1.5
  }
  box(parent, surfaces.rubber, [0.093, 0.102, 1.29], [suv ? -2.15 : -2.217, 0.329, 0], 0.028)
  for (const end of [-1, 1]) {
    const x = end === 1 ? frontX + 0.048 : suv ? -2.245 : -2.312
    const y = end === 1 ? 0.55 : suv ? 0.701 : 0.575
    box(parent, surfaces.rubber, [0.02, 0.108, 0.402], [x, y, 0], 0.008)
    box(parent, surfaces.plate, [0.018, 0.09, 0.377], [x + end * 0.013, y, 0], 0.005)
    for (let index = 0; index < 7; index += 1) {
      box(
        parent,
        surfaces.rubber,
        [0.012, 0.031, 0.009],
        [x + end * 0.026, y, -0.119 + index * 0.039],
        0.002,
      )
    }
  }
}

const createWheel = (surfaces: CarSurfaces, side: number, suv: boolean) => {
  const wheel = new THREE.Group()
  addMesh(wheel, new THREE.TorusGeometry(0.27, 0.07, 6, 32), surfaces.rubber)
  const barrel = addMesh(
    wheel,
    new THREE.CylinderGeometry(0.288, 0.288, 0.185, 32),
    surfaces.rubber,
  )
  barrel.rotation.x = Math.PI / 2
  addMesh(wheel, new THREE.TorusGeometry(0.227, 0.012, 4, 28), surfaces.chrome, [
    0,
    0,
    side * 0.092,
  ])
  const brake = addMesh(
    wheel,
    new THREE.CylinderGeometry(0.195, 0.195, 0.023, 24),
    surfaces.chrome,
    [0, 0, side * 0.054],
  )
  brake.rotation.x = Math.PI / 2
  const center = addMesh(
    wheel,
    new THREE.CylinderGeometry(0.065, 0.065, 0.204, 20),
    surfaces.chrome,
  )
  center.rotation.x = Math.PI / 2
  const spokeCount = 5
  for (let index = 0; index < spokeCount; index += 1) {
    for (const offset of [-1, 1]) {
      const angle = (index / spokeCount) * Math.PI * 2 + offset * (suv ? 0.11 : 0.085)
      const spoke = addMesh(
        wheel,
        new THREE.BoxGeometry(suv ? 0.034 : 0.026, 0.165, 0.026),
        surfaces.chrome,
        [Math.sin(angle) * 0.136, Math.cos(angle) * 0.136, side * 0.104],
      )
      spoke.rotation.z = -angle + offset * 0.035
    }
  }
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2
    const bolt = addMesh(wheel, new THREE.CylinderGeometry(0.01, 0.01, 0.017, 6), surfaces.rubber, [
      Math.sin(angle) * 0.044,
      Math.cos(angle) * 0.044,
      side * 0.108,
    ])
    bolt.rotation.x = Math.PI / 2
  }
  addMesh(wheel, new THREE.TorusGeometry(0.308, 0.003, 3, 24), surfaces.rubber, [
    0,
    0,
    side * 0.047,
  ])
  batch(wheel)
  return wheel
}

export const createRoadCar = (surfaces: CarSurfaces, suv: boolean) => {
  const group = new THREE.Group()
  group.name = suv ? 'campus-suv' : 'campus-sedan'
  addBody(group, surfaces, suv)
  addCabin(group, surfaces, suv)
  addSideDetails(group, surfaces, suv)
  addLightsAndGrilles(group, surfaces, suv)
  batch(group)
  const wheels: THREE.Group[] = []
  for (const x of [-1.31, 1.31]) {
    for (const side of [-1, 1]) {
      const wheel = createWheel(surfaces, side, suv)
      wheel.position.set(x, 0.345, side * (suv ? 0.797 : 0.768))
      group.add(wheel)
      wheels.push(wheel)
    }
  }
  return { group, wheels }
}
