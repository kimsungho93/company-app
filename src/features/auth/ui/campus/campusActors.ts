import * as THREE from 'three'
import { createWalkingPerson } from './campusActorModels'
import { createRoadCar } from './campusCarModels'
import {
  gateOpenAmount,
  sampleCarX,
  sampleWalkingPose,
  type WalkingPose,
  type WalkingRoute,
} from './campusMotion'

const GROUND_Y = 0.15

type Person = {
  group: THREE.Group
  body: THREE.Group
  leftArm: { upper: THREE.Group; lower: THREE.Group }
  rightArm: { upper: THREE.Group; lower: THREE.Group }
  leftLeg: { upper: THREE.Group; lower: THREE.Group }
  rightLeg: { upper: THREE.Group; lower: THREE.Group }
  route: WalkingRoute
  startFraction: number
  pose: WalkingPose
}

const material = (color: number, roughness = 0.75, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

const addMesh = (
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
) => {
  const mesh = new THREE.Mesh(geometry, surface)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const box = (
  parent: THREE.Object3D,
  surface: THREE.Material,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
) => addMesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z)

const createCarShadow = () => {
  const width = 96
  const height = 48
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = (x / (width - 1)) * 2 - 1
      const v = (y / (height - 1)) * 2 - 1
      pixels[(y * width + x) * 4 + 3] = 135 * Math.pow(1 - u * u, 0.65) * Math.pow(1 - v * v, 1.7)
    }
  }
  const map = new THREE.DataTexture(pixels, width, height)
  map.minFilter = THREE.LinearFilter
  map.magFilter = THREE.LinearFilter
  map.needsUpdate = true
  return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
}

export const createCampusActors = (carEnvironment: THREE.Texture | null = null) => {
  const group = new THREE.Group()
  group.name = 'campus-actors'
  const navy = material(0x26394c)
  const cream = material(0xd9dce0)
  const teal = material(0x667b80)
  const trouserMaterial = material(0x242a35)
  const shoes = material(0x202127, 0.55)
  const darkHair = material(0x201b1b, 0.84)
  const brownHair = material(0x3d2922, 0.82)
  const badge = material(0xe8ecef)
  const detail = material(0x344758)
  const skins = [material(0xe4b28d), material(0xbc8869), material(0xd29d78)]
  const shirts = [navy, cream, teal, cream]
  const entryOffsets = [0.22, 0.4, 0.58, 0.72]
  const exitOffsets = [0.02, 0.27, 0.5, 0.75]
  const people: Person[] = []

  for (let index = 0; index < 8; index += 1) {
    const route = index < 4 ? 'entry' : 'exit'
    const model = createWalkingPerson(
      {
        shirt: shirts[index % shirts.length],
        skin: skins[index % skins.length],
        hair: index % 2 ? darkHair : brownHair,
        trousers: trouserMaterial,
        shoes,
        badge,
        detail,
      },
      index,
    )
    model.group.name = `campus-person-${route}-${index}`
    model.group.position.y = GROUND_Y
    const person: Person = {
      ...model,
      route,
      startFraction: route === 'entry' ? entryOffsets[index] : exitOffsets[index - 4],
      pose: { x: 0, z: 0, heading: 0, distance: 0 },
    }
    group.add(person.group)
    people.push(person)
  }

  for (const surface of new Set([
    ...shirts,
    ...skins,
    trouserMaterial,
    shoes,
    darkHair,
    brownHair,
    badge,
    detail,
  ])) {
    surface.dispose()
  }

  const gateGlass = new THREE.MeshStandardMaterial({
    color: 0x92b7b3,
    transparent: true,
    opacity: 0.45,
    roughness: 0.2,
    metalness: 0.12,
    depthWrite: false,
  })
  const gateMetal = material(0x71837f, 0.35, 0.6)
  const gatePivots: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.position.set(3 + side * 0.52, GROUND_Y, 3.2)
    box(pivot, gateGlass, 0.49, 0.66, 0.028, -side * 0.245, 0.77, 0)
    box(pivot, gateMetal, 0.49, 0.022, 0.034, -side * 0.245, 1.11, 0)
    box(pivot, gateMetal, 0.035, 0.74, 0.045, 0, 0.77, 0)
    group.add(pivot)
    gatePivots.push(pivot)
  }

  const carGlass = new THREE.MeshPhysicalMaterial({
    color: 0x18252e,
    roughness: 0.085,
    metalness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    envMap: carEnvironment,
    envMapIntensity: 0.9,
  })
  const rubber = material(0x15191e, 0.88)
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xb6bdc2,
    roughness: 0.24,
    metalness: 0.88,
    envMap: carEnvironment,
    envMapIntensity: 0.95,
  })
  const headlight = new THREE.MeshStandardMaterial({
    color: 0xe9f4ff,
    emissive: 0xc5deff,
    emissiveIntensity: 0.15,
    roughness: 0.18,
    metalness: 0.2,
  })
  const taillight = new THREE.MeshPhysicalMaterial({
    color: 0xb51828,
    emissive: 0x920615,
    emissiveIntensity: 0.3,
    roughness: 0.19,
    clearcoat: 1,
  })
  const plate = material(0xe1e4e6, 0.58)
  const carPaints = [0x62666c, 0xf0f0e9, 0x505760, 0xe9eceb].map(
    (color, index) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: index % 2 === 0 ? 0.68 : 0.16,
        roughness: index % 2 === 0 ? 0.25 : 0.29,
        clearcoat: 1,
        clearcoatRoughness: 0.075,
        envMap: carEnvironment,
        envMapIntensity: 0.8,
      }),
  )
  const carOffsets = [0.17, 0.69, 0.37, 0.89]
  const carLaneZ = [9, 11.6, 14.4, 17.2]
  const contactShadow = createCarShadow()
  const cars = carPaints.map((paint, index) => {
    const car = createRoadCar(
      { paint, glass: carGlass, rubber, chrome, headlight, taillight, plate },
      index % 2 === 1,
    )
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 2.1), contactShadow)
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.008
    car.group.add(shadow)
    car.group.position.y = GROUND_Y
    const direction: 1 | -1 = index < 2 ? 1 : -1
    car.group.position.z = carLaneZ[index]
    car.group.rotation.y = direction === 1 ? 0 : Math.PI
    group.add(car.group)
    return { ...car, direction, speed: direction === 1 ? 12.2 : 10.8, offset: carOffsets[index] }
  })

  const update = (elapsedSeconds: number) => {
    let nearestPerson = Infinity
    for (const person of people) {
      sampleWalkingPose(elapsedSeconds, person.startFraction, person.route, person.pose)
      const { pose } = person
      person.group.position.x = pose.x
      person.group.position.z = pose.z
      person.group.rotation.y = pose.heading
      const phase = pose.distance * 7.8
      const stride = Math.sin(phase)
      person.leftLeg.upper.rotation.x = -stride * 0.34
      person.rightLeg.upper.rotation.x = stride * 0.34
      person.leftLeg.lower.rotation.x = Math.max(0, Math.cos(phase)) * 0.53
      person.rightLeg.lower.rotation.x = Math.max(0, -Math.cos(phase)) * 0.53
      person.leftArm.upper.rotation.x = stride * 0.24
      person.rightArm.upper.rotation.x = -stride * 0.24
      person.leftArm.lower.rotation.x = -0.14 - Math.max(0, stride) * 0.1
      person.rightArm.lower.rotation.x = -0.14 - Math.max(0, -stride) * 0.1
      person.body.position.y = -(1 - Math.cos(stride * 0.34)) * 0.75
      person.body.rotation.z = stride * 0.008
      person.body.rotation.y = stride * 0.017
      nearestPerson = Math.min(nearestPerson, Math.hypot(pose.x - 3, pose.z - 3.2))
    }
    const gateAngle = gateOpenAmount(nearestPerson) * Math.PI * 0.5
    gatePivots[0].rotation.y = gateAngle
    gatePivots[1].rotation.y = -gateAngle

    for (const car of cars) {
      car.group.position.x = sampleCarX(elapsedSeconds, car.offset, car.direction, car.speed)
      for (const wheel of car.wheels) {
        wheel.rotation.z = (-elapsedSeconds * car.speed) / 0.34
      }
    }
  }

  update(0)
  return { group, update }
}
