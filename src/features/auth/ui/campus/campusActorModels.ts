import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

type Surface = THREE.Material

const mesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: Surface,
  x = 0,
  y = 0,
  z = 0,
) => {
  const result = new THREE.Mesh(geometry, material)
  result.position.set(x, y, z)
  result.castShadow = true
  result.receiveShadow = true
  parent.add(result)
  return result
}

const roundedBox = (
  parent: THREE.Object3D,
  material: Surface,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  radius = 0.02,
) => mesh(parent, new RoundedBoxGeometry(width, height, depth, 1, radius), material, x, y, z)

const ellipsoid = (
  parent: THREE.Object3D,
  material: Surface,
  radii: [number, number, number],
  position: [number, number, number],
) => {
  const result = mesh(parent, new THREE.SphereGeometry(1, 10, 8), material, ...position)
  result.scale.set(...radii)
  return result
}

const rod = (
  parent: THREE.Object3D,
  material: Surface,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
) => {
  const direction = end.clone().sub(start)
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
    material,
  )
  result.position.copy(start).add(end).multiplyScalar(0.5)
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return result
}

const trim = (parent: THREE.Object3D, material: Surface, points: THREE.Vector3[], radius: number) =>
  mesh(
    parent,
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, radius, 4, false),
    material,
  )

const batchStaticMeshes = (parent: THREE.Group, vertexMaterial?: THREE.MeshStandardMaterial) => {
  const batches = new Map<Surface, THREE.BufferGeometry[]>()
  const originalGeometries = new Set<THREE.BufferGeometry>()
  for (const child of [...parent.children]) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue
    child.updateMatrix()
    const transformed = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone()
    transformed.applyMatrix4(child.matrix)
    for (const attribute of Object.keys(transformed.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal' && attribute !== 'uv') {
        transformed.deleteAttribute(attribute)
      }
    }
    if (vertexMaterial && child.material instanceof THREE.MeshStandardMaterial) {
      const color = child.material.color
      const colors = new Float32Array(transformed.getAttribute('position').count * 3)
      for (let index = 0; index < colors.length; index += 3) {
        colors[index] = color.r
        colors[index + 1] = color.g
        colors[index + 2] = color.b
      }
      transformed.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    const material =
      vertexMaterial && child.material instanceof THREE.MeshStandardMaterial
        ? vertexMaterial
        : child.material
    const batch = batches.get(material) ?? []
    batch.push(transformed)
    batches.set(material, batch)
    originalGeometries.add(child.geometry)
    parent.remove(child)
  }
  for (const [material, geometries] of batches) {
    const combined = mergeGeometries(geometries)
    if (combined) mesh(parent, combined, material)
    for (const geometry of geometries) geometry.dispose()
  }
  for (const geometry of originalGeometries) geometry.dispose()
}

const torsoGeometry = () => {
  const sections = [
    [0.86, 0.123, 0.085],
    [0.92, 0.139, 0.097],
    [1.1, 0.122, 0.086],
    [1.27, 0.15, 0.097],
    [1.37, 0.153, 0.084],
    [1.405, 0.086, 0.063],
  ]
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const segments = 12
  for (const [row, [y, width, depth]] of sections.entries()) {
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2
      positions.push(Math.sin(angle) * width, y, Math.cos(angle) * depth)
      uvs.push(segment / segments, row / (sections.length - 1))
      if (row > 0 && segment > 0) {
        const current = row * (segments + 1) + segment
        indices.push(current - 1, current - segments - 2, current)
        indices.push(current, current - segments - 2, current - segments - 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export type PersonSurfaces = {
  shirt: Surface
  skin: Surface
  hair: Surface
  trousers: Surface
  shoes: Surface
  badge: Surface
  detail: Surface
}

export const createWalkingPerson = (surfaces: PersonSurfaces, variation: number) => {
  const { shirt, skin, hair, trousers, shoes, badge, detail } = surfaces
  const finish = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    vertexColors: true,
  })
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)

  mesh(body, torsoGeometry(), shirt)
  ellipsoid(body, trousers, [0.127, 0.105, 0.087], [0, 0.87, 0])
  mesh(body, new THREE.CylinderGeometry(0.047, 0.055, 0.115, 12), skin, 0, 1.43, 0)
  ellipsoid(body, skin, [0.098, 0.133, 0.105], [0, 1.59, 0.004])
  ellipsoid(body, skin, [0.077, 0.055, 0.081], [0, 1.514, 0.024])
  ellipsoid(body, skin, [0.017, 0.032, 0.021], [0, 1.569, 0.099])
  for (const side of [-1, 1]) {
    ellipsoid(body, skin, [0.013, 0.025, 0.017], [side * 0.096, 1.577, -0.002])
    ellipsoid(body, hair, [0.009, 0.006, 0.004], [side * 0.035, 1.604, 0.103])
    rod(
      body,
      detail,
      new THREE.Vector3(side * 0.043, 1.399, 0.057),
      new THREE.Vector3(0, 1.215, 0.101),
      0.004,
    )
  }
  const hairCap = mesh(
    body,
    new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hair,
    0,
    1.605,
    -0.012,
  )
  hairCap.scale.set(0.103, 0.128, 0.106)
  ellipsoid(body, hair, [0.09, 0.08, 0.041], [0, 1.598, -0.081])
  if (variation % 3 === 1) {
    ellipsoid(body, hair, [0.058, 0.061, 0.06], [0, 1.6, -0.131])
    ellipsoid(body, hair, [0.035, 0.115, 0.04], [0, 1.49, -0.133])
  }
  roundedBox(body, badge, 0.042, 0.064, 0.012, 0, 1.184, 0.104, 0.003)
  roundedBox(body, detail, 0.027, 0.014, 0.002, 0, 1.197, 0.112, 0.001)
  roundedBox(body, trousers, 0.19, 0.022, 0.164, 0, 0.877, 0, 0.006)
  for (const side of [-1, 1]) {
    const collar = roundedBox(body, badge, 0.052, 0.024, 0.061, side * 0.039, 1.402, 0.047, 0.006)
    collar.rotation.z = side * 0.35
  }

  const createArm = (side: number) => {
    const upper = new THREE.Group()
    upper.position.set(side * 0.168, 1.347, 0)
    ellipsoid(upper, shirt, [0.043, 0.061, 0.047], [0, -0.02, 0])
    mesh(upper, new THREE.CylinderGeometry(0.041, 0.031, 0.245, 12), shirt, 0, -0.128, 0)
    const lower = new THREE.Group()
    lower.position.y = -0.257
    ellipsoid(lower, shirt, [0.032, 0.034, 0.034], [0, 0, 0])
    mesh(lower, new THREE.CylinderGeometry(0.03, 0.022, 0.221, 12), shirt, 0, -0.116, 0)
    roundedBox(lower, badge, 0.044, 0.025, 0.047, 0, -0.233, 0, 0.007)
    ellipsoid(lower, skin, [0.022, 0.043, 0.03], [0, -0.274, 0.007])
    upper.add(lower)
    body.add(upper)
    batchStaticMeshes(upper, finish)
    batchStaticMeshes(lower, finish)
    return { upper, lower }
  }

  const createLeg = (side: number) => {
    const upper = new THREE.Group()
    upper.position.set(side * 0.069, 0.86, 0)
    mesh(upper, new THREE.CylinderGeometry(0.062, 0.046, 0.38, 12), trousers, 0, -0.191, 0)
    const lower = new THREE.Group()
    lower.position.y = -0.381
    ellipsoid(lower, trousers, [0.046, 0.045, 0.046], [0, 0, 0])
    mesh(lower, new THREE.CylinderGeometry(0.045, 0.029, 0.365, 12), trousers, 0, -0.184, 0)
    roundedBox(lower, shoes, 0.087, 0.07, 0.199, 0, -0.414, 0.046, 0.025)
    roundedBox(lower, detail, 0.089, 0.017, 0.201, 0, -0.447, 0.046, 0.008)
    upper.add(lower)
    body.add(upper)
    batchStaticMeshes(upper, finish)
    batchStaticMeshes(lower, finish)
    return { upper, lower }
  }

  const leftArm = createArm(-1)
  const rightArm = createArm(1)
  const leftLeg = createLeg(-1)
  const rightLeg = createLeg(1)
  if (variation % 3 === 0) {
    roundedBox(body, trousers, 0.2, 0.285, 0.105, 0, 1.164, -0.115, 0.039)
    roundedBox(body, detail, 0.14, 0.12, 0.025, 0, 1.108, -0.176, 0.019)
    for (const side of [-1, 1]) {
      trim(
        body,
        trousers,
        [
          new THREE.Vector3(side * 0.081, 1.02, 0.097),
          new THREE.Vector3(side * 0.099, 1.26, 0.095),
          new THREE.Vector3(side * 0.101, 1.402, 0),
          new THREE.Vector3(side * 0.078, 1.268, -0.123),
        ],
        0.012,
      )
    }
  }
  batchStaticMeshes(body, finish)
  group.scale.setScalar(0.965 + (variation % 3) * 0.018)
  return { group, body, leftArm, rightArm, leftLeg, rightLeg }
}

type CarSurfaces = {
  paint: Surface
  glass: Surface
  rubber: Surface
  chrome: Surface
  headlight: Surface
  taillight: Surface
  plate: Surface
}

const carBodyGeometry = (suv: boolean) => {
  const shoulder = suv ? 0.99 : 0.84
  const profile = new THREE.Shape()
  profile.moveTo(-2.08, 0.35)
  profile.quadraticCurveTo(-2.21, 0.53, -2.09, shoulder - 0.13)
  profile.quadraticCurveTo(-1.91, shoulder + 0.035, -1.3, shoulder + 0.055)
  profile.lineTo(0.75, shoulder + 0.03)
  profile.quadraticCurveTo(1.74, shoulder + 0.055, 2.07, shoulder - 0.15)
  profile.quadraticCurveTo(2.2, shoulder - 0.21, 2.12, 0.39)
  profile.lineTo(1.734, 0.3)
  profile.lineTo(1.734, 0.345)
  profile.absarc(1.31, 0.345, 0.424, 0, Math.PI, false)
  profile.lineTo(-0.886, 0.345)
  profile.absarc(-1.31, 0.345, 0.424, 0, Math.PI, false)
  profile.lineTo(-1.734, 0.3)
  profile.closePath()
  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth: 1.43,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    curveSegments: 12,
  })
  geometry.translate(0, 0, -0.715)
  return geometry
}

const cabinGeometry = (suv: boolean) => {
  const sections = suv
    ? [
        [-1.45, 0.685, 0.98, 1.04],
        [-1.13, 0.594, 1, 1.59],
        [0.37, 0.583, 1, 1.59],
        [0.99, 0.687, 0.98, 1.035],
      ]
    : [
        [-1.22, 0.67, 0.855, 0.9],
        [-0.65, 0.57, 0.87, 1.39],
        [0.34, 0.575, 0.87, 1.4],
        [0.99, 0.681, 0.857, 0.9],
      ]
  const points: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (const [row, [x, width, bottom, top]] of sections.entries()) {
    const ring = [
      [-width, bottom],
      [-width, bottom + 0.055],
      [-width * 0.91, top - 0.026],
      [-width * 0.79, top],
      [width * 0.79, top],
      [width * 0.91, top - 0.026],
      [width, bottom + 0.055],
      [width, bottom],
    ]
    for (const [column, [z, y]] of ring.entries()) {
      points.push(x, y, z)
      uvs.push(row / (sections.length - 1), column / (ring.length - 1))
      if (row > 0 && column > 0) {
        const current = row * ring.length + column
        indices.push(current - 1, current - ring.length, current)
        indices.push(current - 1, current - ring.length - 1, current - ring.length)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const createRoadCar = (surfaces: CarSurfaces, suv: boolean) => {
  const { paint, glass, rubber, chrome, headlight, taillight, plate } = surfaces
  const group = new THREE.Group()
  group.name = suv ? 'campus-suv' : 'campus-sedan'
  const roofY = suv ? 1.59 : 1.4
  const sillY = suv ? 1 : 0.87
  const rearRoofX = suv ? -1.13 : -0.65
  mesh(group, carBodyGeometry(suv), paint)
  mesh(group, cabinGeometry(suv), glass)
  roundedBox(group, rubber, 3.95, 0.15, 1.43, 0, 0.31, 0, 0.035)
  roundedBox(group, paint, 0.38 - rearRoofX, 0.071, 1.088, (0.34 + rearRoofX) / 2, roofY, 0, 0.034)

  for (const side of [-1, 1]) {
    const z = side * 0.777
    trim(
      group,
      chrome,
      [
        new THREE.Vector3(-1.29, sillY, side * 0.704),
        new THREE.Vector3(rearRoofX, roofY - 0.018, side * 0.558),
        new THREE.Vector3(0.34, roofY - 0.01, side * 0.558),
        new THREE.Vector3(1.01, sillY, side * 0.7),
      ],
      0.017,
    )
    rod(
      group,
      paint,
      new THREE.Vector3(0.34, roofY - 0.021, side * 0.559),
      new THREE.Vector3(1.013, sillY, side * 0.701),
      0.029,
    )
    rod(
      group,
      paint,
      new THREE.Vector3(rearRoofX, roofY - 0.014, side * 0.555),
      new THREE.Vector3(suv ? -1.46 : -1.24, sillY, side * 0.687),
      0.037,
    )
    rod(
      group,
      rubber,
      new THREE.Vector3(-0.23, roofY - 0.02, side * 0.549),
      new THREE.Vector3(-0.23, sillY, side * 0.69),
      0.035,
    )
    trim(
      group,
      chrome,
      [
        new THREE.Vector3(-1.48, sillY - 0.034, z),
        new THREE.Vector3(0, sillY - 0.031, z),
        new THREE.Vector3(1.66, sillY - 0.07, z),
      ],
      0.007,
    )
    for (const x of [-0.79, 0.32]) {
      roundedBox(group, chrome, 0.169, 0.025, 0.028, x, sillY - 0.104, z, 0.01)
    }
    for (const x of [-0.92, 0.49]) {
      rod(
        group,
        rubber,
        new THREE.Vector3(x, 0.402, z + side * 0.002),
        new THREE.Vector3(x - 0.07, sillY - 0.08, z + side * 0.002),
        0.003,
      )
    }
    roundedBox(group, rubber, 0.091, 0.04, 0.18, 0.756, sillY + 0.048, side * 0.76, 0.015)
    roundedBox(group, paint, 0.217, 0.099, 0.157, 0.706, sillY + 0.071, side * 0.84, 0.036)
    roundedBox(group, glass, 0.012, 0.063, 0.115, 0.596, sillY + 0.074, side * 0.842, 0.01)
    roundedBox(group, headlight, 0.041, 0.103, 0.374, 2.198, sillY - 0.228, side * 0.5, 0.02)
    roundedBox(group, chrome, 0.043, 0.02, 0.323, 2.224, sillY - 0.219, side * 0.5, 0.006)
    roundedBox(group, taillight, 0.035, 0.107, 0.387, -2.154, sillY - 0.271, side * 0.499, 0.015)
    roundedBox(group, rubber, 0.35, 0.075, 0.027, 0, 0.335, z, 0.017)
    if (suv) {
      rod(
        group,
        chrome,
        new THREE.Vector3(-1.13, roofY + 0.068, side * 0.442),
        new THREE.Vector3(0.27, roofY + 0.068, side * 0.442),
        0.018,
      )
    }
  }
  roundedBox(group, rubber, 0.045, 0.192, 0.805, 2.217, 0.434, 0, 0.023)
  for (let index = 0; index < 4; index += 1) {
    roundedBox(group, chrome, 0.048, 0.009, 0.743, 2.246, 0.376 + index * 0.038, 0, 0.004)
  }
  roundedBox(group, rubber, 0.104, 0.117, 1.25, -2.109, 0.364, 0, 0.026)
  for (const end of [-1, 1]) {
    const plateX = end === 1 ? 2.253 : -2.172
    roundedBox(group, plate, 0.017, 0.086, 0.323, plateX, 0.402, 0, 0.008)
    for (let index = 0; index < 6; index += 1) {
      roundedBox(
        group,
        rubber,
        0.019,
        0.032,
        0.012,
        plateX + end * 0.011,
        0.405,
        -0.1 + index * 0.04,
        0.002,
      )
    }
  }
  batchStaticMeshes(group)

  const wheels: THREE.Group[] = []
  for (const x of [-1.31, 1.31]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group()
      wheel.position.set(x, 0.345, side * 0.756)
      mesh(wheel, new THREE.TorusGeometry(0.257, 0.083, 8, 24), rubber)
      const tire = mesh(wheel, new THREE.CylinderGeometry(0.275, 0.275, 0.195, 20), rubber)
      tire.rotation.x = Math.PI / 2
      const rim = mesh(wheel, new THREE.CylinderGeometry(0.212, 0.212, 0.199, 20), chrome)
      rim.rotation.x = Math.PI / 2
      const inner = mesh(wheel, new THREE.CylinderGeometry(0.186, 0.186, 0.207, 20), rubber)
      inner.rotation.x = Math.PI / 2
      for (let spoke = 0; spoke < 5; spoke += 1) {
        const angle = (spoke * Math.PI * 2) / 5
        const spokeMesh = roundedBox(
          wheel,
          chrome,
          0.047,
          0.17,
          0.028,
          Math.sin(angle) * 0.101,
          Math.cos(angle) * 0.101,
          side * 0.115,
          0.01,
        )
        spokeMesh.rotation.z = -angle
      }
      const hub = mesh(wheel, new THREE.CylinderGeometry(0.063, 0.063, 0.24, 16), chrome)
      hub.rotation.x = Math.PI / 2
      mesh(wheel, new THREE.TorusGeometry(0.309, 0.004, 4, 24), rubber, 0, 0, side * 0.055)
      batchStaticMeshes(wheel)
      group.add(wheel)
      wheels.push(wheel)
    }
  }
  return { group, wheels }
}
