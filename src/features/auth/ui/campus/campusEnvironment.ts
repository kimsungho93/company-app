import * as THREE from 'three'

import { createCampusLandscape } from './campusLandscape'
import { createSurfaceTexture } from './campusSurfaceTextures'

type Instance = {
  position: [number, number, number]
  scale: [number, number, number]
  color: THREE.ColorRepresentation
  rotation?: [number, number, number]
}

export const createCampusEnvironment = (): THREE.Group => {
  const campus = new THREE.Group()
  campus.name = 'industrial-campus-environment'
  const concreteTexture = createSurfaceTexture('concrete')
  const concrete = new THREE.MeshStandardMaterial({
    map: concreteTexture,
    bumpMap: concreteTexture,
    bumpScale: 0.008,
    roughness: 0.86,
  })
  const metal = new THREE.MeshStandardMaterial({ roughness: 0.39, metalness: 0.44 })
  const glazing = new THREE.MeshPhysicalMaterial({
    roughness: 0.14,
    metalness: 0.33,
    clearcoat: 1,
    clearcoatRoughness: 0.09,
    envMapIntensity: 1.3,
  })
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#c9e2ec',
    roughness: 0.07,
    metalness: 0.1,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 14)
  const batches = {
    concrete: {
      material: concrete,
      geometry: boxGeometry,
      instances: [] as Instance[],
      shadow: true,
    },
    ground: {
      material: concrete,
      geometry: boxGeometry,
      instances: [] as Instance[],
      shadow: false,
    },
    metal: { material: metal, geometry: boxGeometry, instances: [] as Instance[], shadow: true },
    trim: { material: metal, geometry: boxGeometry, instances: [] as Instance[], shadow: false },
    glazing: {
      material: glazing,
      geometry: boxGeometry,
      instances: [] as Instance[],
      shadow: false,
    },
    glass: { material: glass, geometry: boxGeometry, instances: [] as Instance[], shadow: false },
    cylinders: {
      material: metal,
      geometry: cylinderGeometry,
      instances: [] as Instance[],
      shadow: true,
    },
  }
  const box = (
    batch: keyof typeof batches,
    position: Instance['position'],
    scale: Instance['scale'],
    color: THREE.ColorRepresentation,
    rotation?: Instance['rotation'],
  ) => {
    batches[batch].instances.push({ position, scale, color, rotation })
  }
  const cylinder = (
    position: Instance['position'],
    radius: number,
    height: number,
    color: THREE.ColorRepresentation,
  ) => box('cylinders', position, [radius, height, radius], color)
  const surface = (
    name: string,
    material: THREE.Material,
    x: number,
    z: number,
    width: number,
    depth: number,
    y: number,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material)
    mesh.name = name
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, y, z)
    mesh.receiveShadow = true
    campus.add(mesh)
  }

  surface(
    'landscape-ground',
    new THREE.MeshStandardMaterial({ color: '#7f8866', roughness: 1 }),
    0,
    -38,
    220,
    160,
    -0.06,
  )
  const pavingTexture = createSurfaceTexture('paving')
  pavingTexture.repeat.set(35, 8)
  surface(
    'factory-courtyard-paving',
    new THREE.MeshStandardMaterial({
      map: pavingTexture,
      bumpMap: pavingTexture,
      bumpScale: 0.015,
      roughness: 0.9,
    }),
    -2,
    -4,
    46,
    23,
    0.025,
  )
  const asphaltTexture = createSurfaceTexture('asphalt')
  asphaltTexture.repeat.set(48, 6)
  surface(
    'granular-asphalt-road',
    new THREE.MeshStandardMaterial({
      map: asphaltTexture,
      bumpMap: asphaltTexture,
      bumpScale: 0.027,
      roughness: 0.86,
    }),
    0,
    13.05,
    180,
    11.2,
    0.125,
  )
  const sidewalkTexture = createSurfaceTexture('paving')
  sidewalkTexture.repeat.set(70, 1.3)
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    map: sidewalkTexture,
    bumpMap: sidewalkTexture,
    bumpScale: 0.018,
    roughness: 0.87,
  })
  surface('front-pedestrian-paving', sidewalkMaterial, 0, 5.78, 180, 3.34, 0.181)
  surface('opposite-pedestrian-paving', sidewalkMaterial, 0, 19.7, 180, 2.1, 0.181)
  box('ground', [3, 0.09, 1.82], [2.3, 0.18, 7.75], '#d8d9d1')

  for (let x = -88; x < 90; x += 1) {
    if (x < 1.5 || x > 4.5)
      box('concrete', [x, 0.17, 7.42], [0.98, 0.24, 0.2], x % 3 === 0 ? '#aeb4b0' : '#d8dad4')
    box('concrete', [x, 0.17, 18.64], [0.98, 0.24, 0.2], '#c9ceca')
  }
  for (const z of [13, 13.15]) box('ground', [0, 0.13, z], [180, 0.006, 0.055], '#d9b74a')
  for (const z of [7.82, 18.27]) box('ground', [0, 0.13, z], [180, 0.006, 0.06], '#d4d6ce')
  for (let x = -88; x < 90; x += 4.8) {
    if (x > 0.5 && x < 5.5) continue
    for (const z of [10.25, 15.85]) box('ground', [x, 0.13, z], [2.1, 0.006, 0.085], '#e3e5db')
  }
  for (let z = 7.9; z < 18.4; z += 0.65) box('ground', [3, 0.135, z], [2.3, 0.011, 0.32], '#e7e8e1')
  box('ground', [0.89, 0.138, 10.25], [0.13, 0.018, 4.8], '#e7e8e1')
  box('ground', [5.16, 0.138, 15.85], [0.13, 0.018, 4.8], '#e7e8e1')
  for (const z of [7.05, 18.96]) {
    box('ground', [3, 0.19, z], [2.1, 0.014, 0.38], '#baa66c')
    for (let x = 2.05; x < 4; x += 0.16)
      for (let dz = -0.13; dz <= 0.14; dz += 0.13)
        cylinder([x, 0.202, z + dz], 0.023, 0.012, '#c6b476')
  }
  for (const x of [-12, -4, 11, 20]) {
    box('metal', [x, 0.188, 7.21], [0.8, 0.012, 0.3], '#424948')
    for (let dx = -0.35; dx < 0.4; dx += 0.085)
      box('metal', [x + dx, 0.198, 7.21], [0.025, 0.014, 0.3], '#8b918c')
  }

  box('concrete', [-3, 0.16, -5], [20.45, 0.32, 8.5], '#a2aba8')
  box('metal', [-5.7, 5.85, -5], [14.6, 11.4, 8], '#e4e9e8')
  box('metal', [5.7, 5.85, -5], [2.6, 11.4, 8], '#e4e9e8')
  box('metal', [3, 7.18, -5], [2.8, 8.75, 8], '#e4e9e8')
  box('concrete', [3, 1.51, -6.35], [2.8, 2.68, 5.3], '#818f91')
  box('ground', [3, 0.19, -2.26], [2.8, 0.1, 2.53], '#9da9a6')
  box('metal', [-3, 11.66, -5], [20.28, 0.22, 8.22], '#b3bfc1')
  box('metal', [-3, 11.78, -0.94], [20.38, 0.14, 0.29], '#dfe6e5')
  box('metal', [7.09, 11.78, -5], [0.29, 0.14, 8.14], '#dfe6e5')
  box('metal', [-3, 6.3, -0.891], [20.13, 0.28, 0.18], '#ea002c')
  box('metal', [7.05, 6.3, -5], [0.18, 0.28, 8.12], '#ea002c')
  box('metal', [-3, 6.09, -0.81], [20.22, 0.055, 0.24], '#a8b5b7')
  box('metal', [7.13, 6.09, -5], [0.24, 0.055, 8.12], '#a8b5b7')

  for (let y = 0.7; y < 11.5; y += 0.54) {
    if (
      [2.35, 4.7, 7.85].some((windowY) => Math.abs(windowY - y) < 0.52) ||
      Math.abs(y - 6.3) < 0.2
    )
      continue
    const sections =
      y < 2.9
        ? [
            [-5.7, 14.6],
            [5.7, 2.6],
          ]
        : [[-3, 20]]
    for (const [x, width] of sections) box('trim', [x, y, -0.885], [width, 0.018, 0.045], '#bcc7c8')
    box('trim', [7.081, y, -5], [0.045, 0.018, 8], '#b9c5c7')
  }
  for (const x of [-13, -9, -5, -1, 7]) {
    box('metal', [x, 5.92, -0.77], [0.15, 11.41, 0.3], '#657982')
    box('metal', [x + 0.12, 5.92, -0.62], [0.065, 11.43, 0.07], '#d4dedf')
  }
  for (const z of [-8.96, -5, -1.1]) box('metal', [7.15, 5.92, z], [0.3, 11.41, 0.15], '#778b92')
  for (const y of [2.35, 4.7, 7.85]) {
    const sections =
      y < 3
        ? [
            [-5.7, 14.2],
            [5.65, 2.05],
          ]
        : [[-3, 19.5]]
    for (const [x, width] of sections) {
      box('metal', [x, y, -0.83], [width, 1.09, 0.15], '#2f414a')
      box('glazing', [x, y, -0.737], [width - 0.1, 0.89, 0.065], '#5c7888')
      box('metal', [x, y - 0.55, -0.62], [width + 0.12, 0.065, 0.35], '#b4c0c3')
      box('metal', [x, y + 0.54, -0.72], [width + 0.07, 0.055, 0.2], '#d4dddf')
    }
    for (let x = -12.45; x < 6.8; x += 0.8) {
      if (y < 3 && x > 1.5 && x < 4.6) continue
      box('metal', [x, y, -0.68], [0.034, 0.94, 0.06], '#a9b8bc')
      if (Math.round((x + 13) * 10) % 3 === 0)
        box('glazing', [x + 0.2, y + 0.18, -0.696], [0.29, 0.4, 0.014], '#839aa6')
    }
    box('glazing', [7.107, y, -5], [0.07, 0.89, 7.56], '#506b7b')
    box('metal', [7.19, y - 0.54, -5], [0.31, 0.06, 7.74], '#a6b5bb')
    for (let z = -8.65; z < -1.15; z += 0.79)
      box('metal', [7.151, y, z], [0.065, 0.97, 0.038], '#afc0c7')
  }
  for (const x of [1.51, 4.49]) box('metal', [x, 1.57, -0.84], [0.19, 2.85, 0.3], '#becacc')
  box('metal', [3, 2.99, -0.84], [3.17, 0.18, 0.3], '#becacc')
  box('metal', [3, 1.55, -3.7], [2.8, 2.7, 0.06], '#26373e')
  box('metal', [3, 3.1, -0.12], [3.55, 0.12, 1.38], '#789297')
  box('metal', [3, 3.19, -0.12], [3.66, 0.07, 1.46], '#d2dfdf')
  for (const x of [-8.15, -5.67]) {
    box('metal', [x, 1.15, -0.69], [1.83, 1.5, 0.16], '#7f9095')
    for (let y = 0.48; y < 1.9; y += 0.1)
      box('metal', [x, y, -0.585], [1.77, 0.033, 0.13], '#b3c0c1', [-0.25, 0, 0])
  }
  for (const x of [-9.2, -4.8, -0.4, 4]) {
    box('metal', [x, 11.95, -6.4], [2.25, 0.6, 1.48], '#97a5a8')
    box('metal', [x, 12.29, -6.4], [2.38, 0.09, 1.6], '#c7d1d1')
    for (let dx = -0.9; dx < 1; dx += 0.15)
      box('metal', [x + dx, 11.97, -5.64], [0.035, 0.4, 0.036], '#667b81')
  }

  box('ground', [6.3, 0.17, 2.6], [3.25, 0.26, 3.05], '#afbab8')
  box('concrete', [6.3, 0.45, 2.6], [3, 0.44, 2.8], '#c3ccc9')
  box('glass', [6.3, 1.72, 4.017], [2.94, 2.01, 0.025], '#c9dce1')
  box('glass', [7.817, 1.72, 2.6], [0.025, 2.01, 2.78], '#afc9d1')
  box('glass', [4.782, 1.72, 2.6], [0.025, 2.01, 2.78], '#d9e8e9')
  box('metal', [6.3, 1.66, 1.2], [3, 2.66, 0.07], '#788d97')
  for (const x of [4.8, 5.8, 6.8, 7.8])
    box('metal', [x, 1.72, 4.035], [0.055, 2.04, 0.075], '#8b9ea3')
  for (const x of [4.8, 7.8]) {
    for (const z of [1.21, 2.6]) box('metal', [x, 1.72, z], [0.055, 2.04, 0.07], '#8b9ea3')
    box('metal', [x, 0.7, 2.6], [0.075, 0.06, 2.86], '#8b9ea3')
  }
  box('metal', [6.3, 2.81, 2.6], [3.19, 0.18, 2.98], '#bfcacc')
  box('concrete', [6.3, 1.1, 2.78], [1.8, 0.1, 0.73], '#908a7a')
  box('metal', [6.48, 1.46, 2.68], [0.49, 0.37, 0.065], '#202b31')
  box('metal', [6.48, 1.25, 2.68], [0.06, 0.15, 0.13], '#596b71')
  cylinder([6.48, 0.68, 1.95], 0.27, 0.11, '#425760')
  cylinder([6.48, 0.41, 1.95], 0.06, 0.47, '#83969c')

  box('metal', [4.03, 3.1, 3.25], [8.5, 0.14, 2.94], '#cbd5d7')
  box('metal', [4.03, 3.21, 3.25], [8.6, 0.08, 3.02], '#e0e7e7')
  box('metal', [4.03, 2.97, 3.25], [8.12, 0.09, 2.7], '#647a80')
  box('metal', [4.03, 3.09, 4.73], [8.61, 0.25, 0.08], '#9bafb5')
  for (let x = 0.3; x < 8; x += 0.6) box('metal', [x, 2.914, 3.25], [0.03, 0.04, 2.58], '#a7b7ba')
  for (const x of [0.05, 4.48, 8.03]) {
    cylinder([x, 1.63, 2.18], 0.09, 2.96, '#9eafb3')
    box('metal', [x, 0.21, 2.18], [0.31, 0.06, 0.31], '#7b8c90')
  }
  for (const x of [0.05, 8.03]) cylinder([x, 1.63, 4.28], 0.09, 2.96, '#9eafb3')
  for (const x of [2.37, 3.63]) {
    box('metal', [x, 0.69, 3.18], [0.27, 1.08, 0.65], '#a3b5bc')
    box('metal', [x, 1.26, 3.18], [0.3, 0.09, 0.7], '#283e49')
    box('glazing', [x, 1.317, 3.37], [0.14, 0.025, 0.14], '#8acdc4')
    box('metal', [x, 0.69, 3.512], [0.17, 0.64, 0.012], '#c8d1d3')
  }
  for (const x of [1.61, 4.4]) {
    cylinder([x, 0.68, 3.23], 0.047, 1.1, '#98acb2')
    box('metal', [x, 1.16, 3.24], [0.045, 0.045, 1.49], '#b5c5ca')
  }

  for (const [x, width] of [
    [-9.4, 15.5],
    [14.6, 11.4],
  ]) {
    box('ground', [x, 0.18, 3.12], [width, 0.16, 1.28], '#5d624b')
    box('concrete', [x, 0.28, 3.77], [width, 0.32, 0.12], '#bfc7bd')
    box('concrete', [x, 0.28, 2.47], [width, 0.32, 0.12], '#bfc7bd')
    for (let dx = -width / 2; dx < width / 2; dx += 1.3)
      box('concrete', [x + dx, 0.3, 3.78], [0.015, 0.31, 0.125], '#989f95')
  }
  for (const x of [-17.5, -8.5, 11.8, 23]) {
    cylinder([x, 2.47, 6.65], 0.044, 4.64, '#586f7b')
    cylinder([x, 0.4, 6.65], 0.072, 0.46, '#586f7b')
    box('metal', [x + 0.5, 4.74, 6.65], [1.05, 0.05, 0.065], '#586f7b')
    box('metal', [x + 0.89, 4.7, 6.65], [0.54, 0.1, 0.23], '#7e929b')
    box('ground', [x + 0.9, 4.643, 6.65], [0.42, 0.014, 0.17], '#e4e8df')
  }
  for (const x of [-1.15, 7.48]) {
    cylinder([x, 0.63, 6.55], 0.061, 0.95, '#455f6b')
    cylinder([x, 0.94, 6.55], 0.065, 0.035, '#cbd4cc')
  }
  for (const x of [-10.5, 13]) {
    for (const z of [4.44, 4.59, 4.74]) box('concrete', [x, 0.57, z], [1.8, 0.075, 0.12], '#796b52')
    for (const dx of [-0.62, 0.62])
      box('metal', [x + dx, 0.36, 4.6], [0.065, 0.41, 0.43], '#445960')
  }

  for (const [x, originalZ, width, originalHeight, depth] of [
    [-27, -31, 7, 20, 8],
    [-17, -36, 6, 25, 8],
    [-5, -42, 8, 22, 9],
    [11, -38, 7, 24, 8],
    [22, -31, 7, 19, 9],
    [32, -30, 8, 27, 8],
    [44, -37, 10, 21, 10],
  ]) {
    const z = originalZ - 15
    const height = originalHeight * 0.7
    box('concrete', [x, height / 2, z], [width, height, depth], '#b0bdc2')
    box('metal', [x, height + 0.22, z], [width + 0.2, 0.44, depth + 0.2], '#a2b2ba')
    box('concrete', [x, height + 0.72, z - 1], [width * 0.55, 0.9, depth * 0.54], '#b8c6cb')
    for (let y = 1.2; y < height - 0.3; y += 1.48) {
      box('glazing', [x, y, z + depth / 2 + 0.02], [width - 0.45, 0.77, 0.05], '#79929f')
      box('glazing', [x + width / 2 + 0.02, y, z], [0.05, 0.77, depth - 0.45], '#748d9d')
      box('concrete', [x, y - 0.44, z + depth / 2 + 0.11], [width, 0.13, 0.22], '#c3cdd0')
    }
    for (let dx = -width / 2 + 0.6; dx < width / 2; dx += 1.35)
      box('concrete', [x + dx, height / 2, z + depth / 2 + 0.08], [0.13, height, 0.16], '#c1cdd0')
  }

  const transform = new THREE.Object3D()
  for (const [name, batch] of Object.entries(batches)) {
    if (!batch.instances.length) continue
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.instances.length)
    mesh.name = `campus-${name}`
    mesh.castShadow = batch.shadow
    mesh.receiveShadow = true
    for (const [index, instance] of batch.instances.entries()) {
      transform.position.set(...instance.position)
      transform.scale.set(...instance.scale)
      transform.rotation.set(...(instance.rotation ?? [0, 0, 0]))
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix)
      mesh.setColorAt(index, new THREE.Color(instance.color))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    campus.add(mesh)
  }
  campus.add(createCampusLandscape())
  return campus
}
