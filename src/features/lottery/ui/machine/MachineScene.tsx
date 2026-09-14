import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BufferGeometry, CatmullRomCurve3, Curve, DoubleSide, Float32BufferAttribute, FrontSide, PMREMGenerator, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { LotteryMachineProps } from '../LotteryMachine'
import { SETTLE_DURATION_MS } from '../../model/drawTiming'
import { NameBall } from './NameBall'
import { ballRadius, chutePosition, GLOBE_CENTER_Y, GLOBE_RADIUS, restingPositions, rollingPosition } from './motion'
import type { BallPosition } from './motion'

type MachineSceneProps = LotteryMachineProps & { mixing: boolean; reducedMotion: boolean; onContextLost: () => void }
type Coordinates = [number, number, number]

class BallPath extends Curve<Vector3> {
  positionAt: (progress: number) => BallPosition

  constructor(positionAt: (progress: number) => BallPosition) {
    super()
    this.positionAt = positionAt
  }

  override getPoint(progress: number, target = new Vector3()) {
    return target.set(...this.positionAt(progress))
  }
}

const rimVertexShader = `
varying vec3 viewNormal;
varying vec3 viewDirection;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  viewNormal = normalize(normalMatrix * normal);
  viewDirection = -viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}`

const rimFragmentShader = `
varying vec3 viewNormal;
varying vec3 viewDirection;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(viewDirection))), 4.2);
  gl_FragColor = vec4(0.12, 0.22, 0.3, rim * 0.5);
  #include <colorspace_fragment>
}`

const RoundedBlock = ({ size, position, color, radius = 0.08, metalness = 0.2, roughness = 0.4 }: {
  size: Coordinates
  position: Coordinates
  color: string
  radius?: number
  metalness?: number
  roughness?: number
}) => {
  const [width, height, depth] = size
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 4, radius), [width, height, depth, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness} clearcoat={0.22} clearcoatRoughness={0.38} />
    </mesh>
  )
}

const StudioEnvironment = () => {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const environment = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const map = generator.fromScene(environment, 0.045)
    const previousEnvironment = scene.environment
    const previousIntensity = scene.environmentIntensity
    scene.environment = map.texture
    scene.environmentIntensity = 0.5
    invalidate()
    environment.dispose()
    generator.dispose()
    return () => {
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousIntensity
      map.dispose()
    }
  }, [gl, scene, invalidate])
  return null
}

const Mixer = ({ drawing, serverOffsetMs, reducedMotion }: { drawing: boolean; serverOffsetMs: number; reducedMotion: boolean }) => {
  const mixer = useRef<Group>(null)
  const wasDrawing = useRef(drawing)
  const stopping = useRef<{ angle: number; startedAt: number } | null>(null)
  useFrame(() => {
    if (!mixer.current || reducedMotion) return
    const now = Date.now() + serverOffsetMs
    if (drawing) {
      wasDrawing.current = true
      stopping.current = null
      mixer.current.rotation.z = now / 1000 * 5.5
    } else {
      if (!stopping.current) {
        if (!wasDrawing.current) return
        stopping.current = { angle: mixer.current.rotation.z, startedAt: now }
        wasDrawing.current = false
      }
      const progress = Math.min(1, (now - stopping.current.startedAt) / SETTLE_DURATION_MS)
      const distance = progress - progress ** 2 + progress ** 3 / 3
      mixer.current.rotation.z = stopping.current.angle + 5.5 * SETTLE_DURATION_MS / 1000 * distance
    }
  })
  return (
    <group ref={mixer} position={[0, GLOBE_CENTER_Y, -0.87]}>
      {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((rotation) => (
        <group key={rotation} rotation={[0, 0, rotation]}>
          <mesh position={[0, 0.46, 0]} castShadow>
            <capsuleGeometry args={[0.027, 0.78, 4, 8]} />
            <meshStandardMaterial color="#9aaab8" metalness={0.7} roughness={0.32} />
          </mesh>
          <mesh position={[0.035, 0.9, 0.025]} rotation={[0, 0.15, -0.28]}>
            <capsuleGeometry args={[0.075, 0.16, 4, 12]} />
            <meshPhysicalMaterial color="#d5e5ed" transparent opacity={0.55} metalness={0.05} roughness={0.22} clearcoat={0.8} depthWrite={false} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.115, 0.115, 0.16, 32]} />
        <meshStandardMaterial color="#7f929f" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.085]}>
        <sphereGeometry args={[0.067, 16, 12]} />
        <meshStandardMaterial color="#d6e0e6" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  )
}

const createTrayGeometry = (curve: Curve<Vector3>, radius: number) => {
  const positions: number[] = []
  const indices: number[] = []
  const lengthSegments = 28
  const radialSegments = 20
  for (let segment = 0; segment <= lengthSegments; segment += 1) {
    const progress = segment / lengthSegments
    const center = curve.getPoint(progress)
    const tangent = curve.getTangent(progress)
    const side = new Vector3(tangent.z, 0, -tangent.x).normalize()
    for (let radial = 0; radial <= radialSegments; radial += 1) {
      const angle = Math.PI + radial / radialSegments * Math.PI
      positions.push(
        center.x + side.x * Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
        center.z + side.z * Math.cos(angle) * radius,
      )
      if (segment < lengthSegments && radial < radialSegments) {
        const current = segment * (radialSegments + 1) + radial
        const next = current + radialSegments + 1
        indices.push(current, current + 1, next, current + 1, next + 1, next)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const Outlet = ({ radius }: { radius: number }) => {
  const tube = useMemo(() => new BallPath(chutePosition), [])
  const tray = useMemo(() => new BallPath(rollingPosition), [])
  const trayRadius = radius + 0.028
  const trayGeometry = useMemo(() => createTrayGeometry(tray, trayRadius), [tray, trayRadius])
  const rims = useMemo(() => [0, 1].map((progress) => ({
    center: tube.getPoint(progress),
    orientation: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tube.getTangent(progress).normalize()),
  })), [tube])
  const rails = useMemo(() => [-1, 1].map((direction) => new CatmullRomCurve3(
    Array.from({ length: 20 }, (_, index) => {
      const progress = index / 19
      const point = tray.getPoint(progress)
      const tangent = tray.getTangent(progress)
      return point.add(new Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(trayRadius * direction))
    }),
  )), [tray, trayRadius])

  useEffect(() => () => trayGeometry.dispose(), [trayGeometry])

  return (
    <>
      <mesh renderOrder={3}>
        <tubeGeometry args={[tube, 40, 0.353, 32, false]} />
        <meshPhysicalMaterial color="#edf8ff" side={FrontSide} transparent opacity={0.14} depthWrite={false} roughness={0.16} clearcoat={0.55} envMapIntensity={0.7} />
      </mesh>
      <mesh renderOrder={2}>
        <tubeGeometry args={[tube, 40, 0.325, 32, false]} />
        <meshPhysicalMaterial color="#c8dbe7" side={BackSide} transparent opacity={0.12} depthWrite={false} roughness={0.16} envMapIntensity={0.6} />
      </mesh>
      {rims.map(({ center, orientation }, index) => (
        <mesh key={index} position={center} quaternion={orientation}>
          <torusGeometry args={[0.34, 0.018, 10, 48]} />
          <meshStandardMaterial color="#c4d0da" metalness={0.75} roughness={0.27} />
        </mesh>
      ))}
      <mesh geometry={trayGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#d5dfe8" side={DoubleSide} metalness={0.5} roughness={0.36} />
      </mesh>
      {rails.map((rail, index) => (
        <mesh key={index} castShadow>
          <tubeGeometry args={[rail, 28, 0.014, 8, false]} />
          <meshStandardMaterial color="#a4b6c5" metalness={0.7} roughness={0.26} />
        </mesh>
      ))}
      {[0.2, 0.85].map((progress) => {
        const center = tray.getPoint(progress)
        const height = center.y - trayRadius + 1.88
        return (
          <mesh key={progress} position={[center.x, -1.88 + height / 2, center.z]} castShadow>
            <cylinderGeometry args={[0.065, 0.065, Math.max(0.025, height), 16]} />
            <meshStandardMaterial color="#8d9eac" metalness={0.65} roughness={0.35} />
          </mesh>
        )
      })}
    </>
  )
}

const AcrylicDrum = () => (
  <group position={[0, GLOBE_CENTER_Y, 0]}>
    <mesh renderOrder={2}>
      <sphereGeometry args={[GLOBE_RADIUS - 0.026, 64, 40]} />
      <meshPhysicalMaterial color="#bfd3df" side={BackSide} transparent opacity={0.012} depthWrite={false} roughness={0.22} envMapIntensity={0.2} />
    </mesh>
    <mesh renderOrder={4}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 40]} />
      <meshPhysicalMaterial color="#eff9ff" side={FrontSide} transparent opacity={0.02} depthWrite={false} roughness={0.16} clearcoat={0.4} clearcoatRoughness={0.24} envMapIntensity={0.4} />
    </mesh>
    <mesh renderOrder={5}>
      <sphereGeometry args={[GLOBE_RADIUS + 0.002, 64, 40]} />
      <shaderMaterial vertexShader={rimVertexShader} fragmentShader={rimFragmentShader} transparent depthWrite={false} side={FrontSide} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[GLOBE_RADIUS, 0.009, 8, 100]} />
      <meshPhysicalMaterial color="#bfccd6" metalness={0.15} roughness={0.22} transparent opacity={0.3} depthWrite={false} />
    </mesh>
  </group>
)

const MachineBody = ({ drawing, radius }: { drawing: boolean; radius: number }) => (
  <>
    <RoundedBlock size={[2.28, 0.8, 1.22]} position={[0, -1.46, -0.54]} color="#293849" radius={0.14} metalness={0.22} roughness={0.46} />
    <RoundedBlock size={[2.32, 0.12, 1.26]} position={[0, -1.025, -0.54]} color="#e3e9ed" radius={0.05} metalness={0.35} roughness={0.3} />
    <RoundedBlock size={[2.78, 0.13, 2.54]} position={[0, -1.935, 0.045]} color="#354455" radius={0.06} metalness={0.3} roughness={0.4} />
    {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
      <mesh key={`${x}:${z}`} position={[x * 1.04, -2.035, z * 0.88]} castShadow>
        <cylinderGeometry args={[0.13, 0.14, 0.07, 24]} />
        <meshStandardMaterial color="#17232f" roughness={0.8} />
      </mesh>
    )))}
    <mesh position={[0, -0.965, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.49, 0.042, 12, 64]} />
      <meshStandardMaterial color="#b6c4ce" metalness={0.8} roughness={0.26} />
    </mesh>
    <mesh position={[-0.74, -1.33, 0.075]}>
      <boxGeometry args={[0.28, 0.031, 0.01]} />
      <meshStandardMaterial color={drawing ? '#91c8ff' : '#a6b7c6'} emissive={drawing ? '#4e99ee' : '#000000'} emissiveIntensity={drawing ? 0.7 : 0} roughness={0.3} />
    </mesh>
    <Outlet radius={radius} />
    <AcrylicDrum />
  </>
)

export const MachineScene = ({ participants, winners, mixing, drawId, serverOffsetMs, reducedMotion, onContextLost }: MachineSceneProps) => {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const drawn = useMemo(() => new Map(winners.map((winner) => [winner.name, Date.parse(winner.drawnAt)])), [winners])
  const remainingPositions = useMemo(() => {
    const names = participants.filter((name) => !drawn.has(name))
    const positions = restingPositions(names.length, participants.length)
    return new Map(names.map((name, index) => [name, positions[index]]))
  }, [participants, drawn])

  useEffect(() => {
    camera.lookAt(0, -0.28, 0)
    invalidate()
    const canvas = gl.domElement
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      onContextLost()
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost)
  }, [camera, gl, invalidate, onContextLost])

  return (
    <>
      <StudioEnvironment />
      <ambientLight intensity={0.38} />
      <hemisphereLight args={['#edf5ff', '#6d7a87', 0.55]} />
      <directionalLight position={[-1.5, 9, 2]} intensity={1.65} castShadow
        shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-camera-near={0.5} shadow-camera-far={16}
        shadow-camera-left={-3.5} shadow-camera-right={3.5} shadow-camera-top={3.5} shadow-camera-bottom={-3.5}
        shadow-bias={-0.0003} shadow-normalBias={0.025} shadow-radius={4} />
      <directionalLight position={[3, 2, -3]} color="#e1ebf6" intensity={0.72} />
      <directionalLight position={[1, 0, 4]} intensity={0.42} />
      <mesh position={[0, -2.075, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <Mixer drawing={mixing} serverOffsetMs={serverOffsetMs} reducedMotion={reducedMotion} />
      {participants.slice(0, 50).map((name, index) => (
        <NameBall key={`${drawId}:${name}`} name={name} index={index} count={participants.length}
          restingPosition={remainingPositions.get(name) ?? [0, GLOBE_CENTER_Y, 0]} drawing={mixing}
          drawId={drawId} drawnAt={drawn.get(name) ?? null} serverOffsetMs={serverOffsetMs} reducedMotion={reducedMotion} />
      ))}
      <MachineBody drawing={mixing} radius={ballRadius(participants.length)} />
    </>
  )
}
