import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Group, Sprite } from 'three'
import { ballRadius, drawnBallPosition, interpolatePosition, swirlingPosition } from './motion'
import type { BallPosition, CaptureOrigin } from './motion'
import { CAPTURE_DURATION_MS, SETTLE_DURATION_MS } from '../../model/drawTiming'
import { ballColor } from './ballColors'

type NameBallProps = {
  name: string
  index: number
  count: number
  drawId: number
  drawing: boolean
  drawnAt: number | null
  serverOffsetMs: number
  reducedMotion: boolean
  restingPosition: BallPosition
}

const createNameTexture = (name: string) => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) throw new Error('이름을 표시할 수 없습니다.')
  context.fillStyle = '#ffffff'
  context.beginPath()
  context.roundRect(4, 4, 504, 184, 88)
  context.fill()
  let fontSize = 132
  context.font = `900 ${fontSize}px "Wanted Sans Variable", "Malgun Gothic", sans-serif`
  while (context.measureText(name).width > 452 && fontSize > 24) {
    fontSize -= 4
    context.font = `900 ${fontSize}px "Wanted Sans Variable", "Malgun Gothic", sans-serif`
  }
  context.fillStyle = '#101828'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(name, 256, 100)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export const NameBall = ({ name, index, count, drawId, drawing, drawnAt, serverOffsetMs, reducedMotion, restingPosition }: NameBallProps) => {
  const group = useRef<Group>(null)
  const label = useRef<Sprite>(null)
  const previousDrawing = useRef(drawing)
  const rendered = useRef(false)
  const transition = useRef<CaptureOrigin | null>(null)
  const capture = useRef<CaptureOrigin | undefined>(undefined)
  const previousDrawnAt = useRef(drawnAt)
  const texture = useMemo(() => createNameTexture(name), [name])
  const radius = ballRadius(count)
  const labelWidth = radius * 1.9

  useEffect(() => () => texture.dispose(), [texture])

  useFrame(({ camera, invalidate }) => {
    if (!group.current) return
    const now = Date.now() + serverOffsetMs
    let position: BallPosition | null

    if (drawing !== previousDrawing.current || (!rendered.current && drawing)) {
      transition.current = { position: group.current.position.toArray() as BallPosition, startedAt: now }
      previousDrawing.current = drawing
    }
    if (drawnAt !== previousDrawnAt.current) {
      if (drawnAt !== null && rendered.current && now < drawnAt + CAPTURE_DURATION_MS) {
        capture.current = { position: group.current.position.toArray() as BallPosition, startedAt: now }
      }
      previousDrawnAt.current = drawnAt
    }

    if (drawnAt !== null) {
      position = reducedMotion ? null : drawnBallPosition(index, count, drawId, drawnAt, now, capture.current)
    } else if (drawing && !reducedMotion) {
      position = swirlingPosition(index, count, drawId, now)
    } else {
      position = restingPosition
    }

    if (drawnAt === null && !reducedMotion && transition.current && position) {
      const progress = (now - transition.current.startedAt) / SETTLE_DURATION_MS
      position = interpolatePosition(transition.current.position, position, progress)
      if (progress >= 1) transition.current = null
      else invalidate()
    }

    group.current.visible = position !== null
    if (position) {
      group.current.position.set(...position)
      label.current?.position.copy(camera.position).sub(group.current.position).normalize().multiplyScalar(radius + 0.012)
    }
    rendered.current = true
  })

  return (
    <group ref={group} position={restingPosition} visible={drawnAt === null}>
      <mesh castShadow>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshPhysicalMaterial color={ballColor(index)} roughness={0.43} metalness={0} clearcoat={0.18} clearcoatRoughness={0.46} specularIntensity={0.35} envMapIntensity={0.3} />
      </mesh>
      <sprite ref={label} renderOrder={6} position={[0, 0, radius + 0.012]} scale={[labelWidth, labelWidth * 0.375, 1]}>
        <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}
