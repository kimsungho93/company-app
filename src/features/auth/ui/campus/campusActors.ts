import * as THREE from 'three'
import { createRoadCar, createWalkingPerson } from './campusActorModels'
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

export const createCampusActors = () => {
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
    color: 0x172a38,
    roughness: 0.075,
    metalness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.045,
    envMapIntensity: 1.1,
  })
  const rubber = material(0x15191e, 0.88)
  const chrome = material(0xc0c9d1, 0.22, 0.92)
  const headlight = new THREE.MeshStandardMaterial({
    color: 0xe9f4ff,
    emissive: 0xc5deff,
    emissiveIntensity: 0.52,
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
  const carPaints = [0xd9e1e8, 0x1b3049, 0x34444d, 0xe6e8e5].map(
    (color) =>
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.63,
        roughness: 0.235,
        clearcoat: 1,
        clearcoatRoughness: 0.115,
        envMapIntensity: 0.85,
      }),
  )
  const carOffsets = [0.17, 0.69, 0.37, 0.89]
  const carLaneZ = [9, 11.6, 14.4, 17.2]
  const cars = carPaints.map((paint, index) => {
    const car = createRoadCar(
      { paint, glass: carGlass, rubber, chrome, headlight, taillight, plate },
      index === 2,
    )
    car.group.position.y = GROUND_Y
    const direction: 1 | -1 = index < 2 ? 1 : -1
    car.group.position.z = carLaneZ[index]
    car.group.rotation.y = direction === 1 ? 0 : Math.PI
    group.add(car.group)
    return { ...car, direction, speed: direction === 1 ? 3.05 : 2.7, offset: carOffsets[index] }
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
