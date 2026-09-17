import * as THREE from 'three'

import { createFoliageTexture } from './campusSurfaceTextures'

export const createCampusLandscape = () => {
  const landscape = new THREE.Group()
  landscape.name = 'branched-trees-and-planted-borders'
  const branchMatrices: THREE.Matrix4[] = []
  const leafMatrices: THREE.Matrix4[] = []
  const leafColors: THREE.Color[] = []
  const transform = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  let seed = 78473
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }

  const branch = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
    const direction = end.clone().sub(start)
    transform.position.copy(start).add(end).multiplyScalar(0.5)
    transform.quaternion.setFromUnitVectors(up, direction.clone().normalize())
    transform.scale.set(radius, direction.length(), radius)
    transform.updateMatrix()
    branchMatrices.push(transform.matrix.clone())
  }

  const leaves = (center: THREE.Vector3, radius: number, count: number, size: number) => {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2
      const vertical = random() * 2 - 1
      const horizontal = Math.sqrt(1 - vertical * vertical)
      const distance = Math.cbrt(random()) * radius
      transform.position.set(
        center.x + Math.cos(angle) * distance * horizontal,
        center.y + vertical * distance * 0.78,
        center.z + Math.sin(angle) * distance * horizontal,
      )
      transform.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI)
      const width = size * (0.74 + random() * 0.42)
      transform.scale.set(width, width * 1.15, width)
      transform.updateMatrix()
      leafMatrices.push(transform.matrix.clone())
      leafColors.push(
        new THREE.Color().setHSL(0.21 + random() * 0.045, 0.11, 0.64 + random() * 0.2),
      )
    }
  }

  const tree = (x: number, z: number, height: number) => {
    const trunk = new THREE.Vector3(x, 0.17, z)
    const fork = new THREE.Vector3(x + (random() - 0.5) * 0.2, height * 0.49, z + 0.1)
    branch(trunk, fork, height * 0.023)
    const top = new THREE.Vector3(x - 0.1, height * 0.83, z)
    branch(fork, top, height * 0.015)
    leaves(top, height * 0.24, 56, height * 0.21)
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + random() * 0.5
      const root = new THREE.Vector3(fork.x, height * (0.32 + i * 0.04), fork.z)
      const reach = height * (0.16 + random() * 0.1)
      const end = new THREE.Vector3(
        x + Math.cos(angle) * reach,
        height * (0.59 + random() * 0.22),
        z + Math.sin(angle) * reach,
      )
      branch(root, end, height * 0.009)
      const tip = end
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * 0.35, height * 0.12, Math.sin(angle) * 0.35))
      branch(end, tip, height * 0.004)
      leaves(tip, height * 0.19, 31, height * 0.2)
    }
  }

  for (const [x, z, height] of [
    [-16, -8, 7.5],
    [-16, -2.5, 6.5],
    [-13.7, 2.5, 5.7],
    [-9.4, 2.6, 5.5],
    [-5.1, 2.6, 5.1],
    [-0.9, 2.7, 4.7],
    [10.1, 2, 5.5],
    [15.8, 2.2, 6.2],
    [12, -4, 7],
    [17, -7.8, 7.8],
    [-22, 2, 7.2],
    [23, 1.9, 6.9],
    [-23, -15, 8],
    [-12, -17, 7.2],
    [0, -18, 8],
    [10, -19, 7.6],
    [22, -18, 8],
    [-16, 20, 6],
    [17, 20, 6.5],
  ])
    tree(x, z, height)

  for (const [start, end] of [
    [-17, -1.8],
    [9, 20],
  ]) {
    for (let x = start; x < end; x += 0.6) {
      leaves(new THREE.Vector3(x, 0.65, 3.15), 0.48, 12, 0.78)
    }
  }

  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.46, 1, 1, 9),
    new THREE.MeshStandardMaterial({ color: '#655b49', roughness: 0.96 }),
    branchMatrices.length,
  )
  trunks.name = 'tapered-tree-trunks-and-branches'
  trunks.castShadow = true
  trunks.receiveShadow = true
  branchMatrices.forEach((matrix, index) => trunks.setMatrixAt(index, matrix))
  trunks.computeBoundingSphere()
  landscape.add(trunks)

  const foliage = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      map: createFoliageTexture(),
      roughness: 0.9,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    }),
    leafMatrices.length,
  )
  foliage.name = 'individual-textured-foliage-sprays'
  foliage.castShadow = true
  foliage.receiveShadow = true
  leafMatrices.forEach((matrix, index) => {
    foliage.setMatrixAt(index, matrix)
    foliage.setColorAt(index, leafColors[index])
  })
  foliage.computeBoundingSphere()
  landscape.add(foliage)
  return landscape
}
