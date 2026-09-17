import * as THREE from 'three'

export type OrbitPerson = { id: number; name: string; color: string }
export type OrbitPoint = { id: number; x: number; y: number; scale: number; depth: number }
export type OrbitColors = { background: string; ring: string; platform: string }
export type OrbitScene = {
  select(id: number | null): void
  setTyping(id: number | null): void
  pulse(id: number): void
  rotateBy(radians: number): void
  updateColors(colors: OrbitColors): void
  dispose(): void
}
type OrbitOptions = {
  host: HTMLElement
  participants: OrbitPerson[]
  onSelect(id: number): void
  onLayout(points: OrbitPoint[]): void
  colors: OrbitColors
  onUnavailable(): void
}

export const createLotteryOrbitScene = ({
  host,
  participants,
  onSelect,
  onLayout,
  colors,
  onUnavailable,
}: OrbitOptions): OrbitScene => {
  if (!host || !participants?.length) throw new Error('Orbit scene needs a host and participants.')
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.setClearColor(0x000000, 0)
  const canvas = renderer.domElement
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    touchAction: 'pan-y',
    cursor: 'grab',
  })
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  const orbit = new THREE.Group(),
    geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>()
  scene.add(orbit, new THREE.HemisphereLight(0xffffff, 0x7a8498, 0.8))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(-3, 7, 5)
  scene.add(key)
  const rimLight = new THREE.DirectionalLight(0xd8e8ff, 1.1)
  rimLight.position.set(4, 2, -4)
  scene.add(rimLight)
  const geometry = <T extends THREE.BufferGeometry>(value: T): T => (geometries.add(value), value)
  const material = <T extends THREE.Material>(value: T): T => (materials.add(value), value)
  const mesh = (
    shape: THREE.BufferGeometry,
    surface: THREE.Material,
    parent: THREE.Object3D = scene,
  ) => {
    const value = new THREE.Mesh(shape, surface)
    parent.add(value)
    return value
  }
  const glass = material(
    new THREE.MeshPhysicalMaterial({
      color: colors.ring,
      metalness: 0.2,
      roughness: 0.11,
      transmission: 0.55,
      thickness: 0.22,
      clearcoat: 1,
      ior: 1.45,
    }),
  )
  const chrome = material(
    new THREE.MeshPhysicalMaterial({
      color: colors.ring,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 1,
    }),
  )
  const platformMaterial = material(
    new THREE.MeshPhysicalMaterial({
      color: colors.platform,
      metalness: 0.18,
      roughness: 0.3,
      clearcoat: 0.8,
    }),
  )
  const torus = (
    radius: number,
    tube: number,
    surface: THREE.Material,
    y: number,
    parent: THREE.Object3D = scene,
  ) => {
    const item = mesh(geometry(new THREE.TorusGeometry(radius, tube, 12, 112)), surface, parent)
    item.rotation.x = Math.PI / 2
    item.position.y = y
    return item
  }
  torus(2.62, 0.075, glass, 0.26)
  torus(2.62, 0.017, chrome, 0.32)
  torus(2.73, 0.013, chrome, 0.19)
  const platform = mesh(geometry(new THREE.CylinderGeometry(0.9, 0.98, 0.1, 80)), platformMaterial)
  platform.position.y = 0.025
  torus(0.88, 0.026, chrome, 0.1)
  torus(0.74, 0.027, glass, 0.43)
  const beadGeometry = geometry(new THREE.SphereGeometry(0.28, 40, 28))
  const waveGeometry = geometry(new THREE.TorusGeometry(0.31, 0.014, 8, 48))
  const nodes = participants.map((person, index) => {
    const group = new THREE.Group(),
      angle = (index * Math.PI * 2) / participants.length + Math.PI / 6
    group.position.set(Math.cos(angle) * 2.62, 0, Math.sin(angle) * 2.62)
    orbit.add(group)
    const surface = material(
      new THREE.MeshPhysicalMaterial({
        color: person.color,
        roughness: 0.12,
        metalness: 0.12,
        transmission: 0.08,
        thickness: 0.45,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        emissive: person.color,
        emissiveIntensity: 0.025,
        envMapIntensity: 1.3,
      }),
    )
    const bead = mesh(beadGeometry, surface, group)
    bead.position.y = 0.59
    bead.userData.id = person.id
    const waveSurface = material(
      new THREE.MeshBasicMaterial({
        color: person.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    const wave = mesh(waveGeometry, waveSurface, group)
    wave.rotation.x = Math.PI / 2
    wave.position.y = 0.34
    wave.visible = false
    return { id: person.id, bead, surface, wave, waveSurface, pulseAt: -Infinity }
  })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const pmrem = new THREE.PMREMGenerator(renderer)
  let environmentTarget: THREE.WebGLRenderTarget | undefined
  const updateEnvironment = () => {
    const studio = new THREE.Scene()
    studio.background = new THREE.Color(colors.background)
    const panelGeometry = new THREE.PlaneGeometry(6, 4)
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1, 1).multiplyScalar(1.8),
      side: THREE.DoubleSide,
    })
    ;[
      [-4, 5, 3],
      [4, 3, -3],
      [0, 7, -2],
    ].forEach((position) => {
      const panel = new THREE.Mesh(panelGeometry, panelMaterial)
      panel.position.set(position[0], position[1], position[2])
      panel.lookAt(0, 0, 0)
      studio.add(panel)
    })
    const next = pmrem.fromScene(studio, 0.04, 0.1, 30)
    scene.environment = next.texture
    environmentTarget?.dispose()
    environmentTarget = next
    panelGeometry.dispose()
    panelMaterial.dispose()
  }
  try {
    updateEnvironment()
  } catch (error) {
    geometries.forEach((value) => value.dispose())
    materials.forEach((value) => value.dispose())
    environmentTarget?.dispose()
    pmrem.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    throw error
  }
  host.appendChild(canvas)
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motion.matches,
    disposed = false,
    lost = false,
    frame = 0,
    lastTime = 0
  let width = 1,
    height = 1,
    angle = 0,
    targetAngle = 0,
    velocity = 0
  let selected: number | null = null,
    typing: number | null = null,
    typingUntil = 0
  let pointer: { id: number; startX: number; lastX: number; time: number; moved: boolean } | null =
    null
  const raycaster = new THREE.Raycaster(),
    pointerPoint = new THREE.Vector2()
  const worldPoint = new THREE.Vector3(),
    projected = new THREE.Vector3()
  const requestFrame = () => {
    if (!disposed && !lost && !frame) frame = requestAnimationFrame(draw)
  }
  const emitLayout = () => {
    camera.updateMatrixWorld()
    orbit.updateMatrixWorld(true)
    onLayout?.(
      nodes.map((node) => {
        node.bead.getWorldPosition(worldPoint)
        projected.copy(worldPoint).project(camera)
        return {
          id: node.id,
          x: ((projected.x + 1) * width) / 2,
          y: ((1 - projected.y) * height) / 2,
          scale: THREE.MathUtils.clamp(
            camera.position.length() / camera.position.distanceTo(worldPoint),
            0.78,
            1.25,
          ),
          depth: projected.z,
        }
      }),
    )
  }
  const draw = (now: number) => {
    frame = 0
    if (disposed) return
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.045) : 1 / 60
    lastTime = now
    let active = false
    if (!pointer && !reduced && Math.abs(velocity) > 0.006) {
      targetAngle += velocity * dt
      velocity *= Math.exp(-10 * dt)
      active = true
    } else if (!pointer) velocity = 0
    const rotationDelta = targetAngle - angle
    angle =
      reduced || Math.abs(rotationDelta) < 0.0004
        ? targetAngle
        : angle + rotationDelta * (1 - Math.exp(-17 * dt))
    active ||= Math.abs(targetAngle - angle) >= 0.0004
    orbit.rotation.y = angle
    nodes.forEach((node) => {
      const typingActive = node.id === typing && now < typingUntil
      const typingLift =
        typingActive && !reduced
          ? Math.sin(Math.min(1, (typingUntil - now) / 900) * Math.PI) * 0.18
          : 0
      const desiredY = 0.59 + (node.id === selected ? 0.28 : 0) + typingLift
      const delta = desiredY - node.bead.position.y
      node.bead.position.y =
        reduced || Math.abs(delta) < 0.001
          ? desiredY
          : node.bead.position.y + delta * (1 - Math.exp(-16 * dt))
      active ||= Math.abs(desiredY - node.bead.position.y) >= 0.001 || (typingActive && !reduced)
      const progress = (now - node.pulseAt) / (reduced ? 180 : 650),
        pulsing = progress >= 0 && progress < 1
      const strength = pulsing
        ? reduced
          ? 0.22
          : Math.sin(progress * Math.PI) * (1 - progress)
        : 0
      node.bead.scale.set(
        reduced ? 1 : 1 + strength * 0.22,
        reduced ? 1 : 1 - strength * 0.2,
        reduced ? 1 : 1 + strength * 0.22,
      )
      node.surface.emissiveIntensity = 0.025 + (node.id === selected ? 0.085 : 0) + strength * 1.4
      node.wave.visible = pulsing && !reduced
      if (node.wave.visible) {
        node.wave.scale.setScalar(1 + progress * 2.2)
        node.waveSurface.opacity = (1 - progress) * 0.7
      }
      active ||= pulsing
    })
    renderer.render(scene, camera)
    emitLayout()
    if (active) requestFrame()
    else lastTime = 0
  }
  const resize = () => {
    const bounds = host.getBoundingClientRect()
    width = Math.max(1, bounds.width)
    height = Math.max(1, bounds.height)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const distance = Math.max(7.9, 3.7 / (Math.tan(THREE.MathUtils.degToRad(17.5)) * camera.aspect))
    camera.position.set(0, distance * 0.49, distance * 0.872)
    camera.lookAt(0, 0.35, 0)
    camera.updateProjectionMatrix()
    requestFrame()
  }
  const select = (id: number | null) => {
    selected = id !== null && byId.has(id) ? id : null
    requestFrame()
  }
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointer) return
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      time: performance.now(),
      moved: false,
    }
    velocity = 0
    canvas.setPointerCapture(event.pointerId)
    canvas.style.cursor = 'grabbing'
  }
  const pointerMove = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const now = performance.now(),
      dx = event.clientX - pointer.lastX
    if (Math.abs(event.clientX - pointer.startX) > 5) pointer.moved = true
    if (pointer.moved) {
      const turn = dx * 0.012
      targetAngle += turn
      velocity = THREE.MathUtils.clamp(turn / Math.max(0.008, (now - pointer.time) / 1000), -3, 3)
      requestFrame()
    }
    pointer.lastX = event.clientX
    pointer.time = now
  }
  const pointerEnd = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return
    const released = pointer
    pointer = null
    canvas.style.cursor = 'grab'
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (event.type !== 'pointerup' || performance.now() - released.time > 90 || reduced)
      velocity = 0
    if (!released.moved && event.type === 'pointerup') {
      const bounds = canvas.getBoundingClientRect()
      pointerPoint.set(
        ((event.clientX - bounds.left) / width) * 2 - 1,
        1 - ((event.clientY - bounds.top) / height) * 2,
      )
      raycaster.setFromCamera(pointerPoint, camera)
      const hit = raycaster.intersectObjects(
        nodes.map((node) => node.bead),
        false,
      )[0]
      if (hit) {
        select(hit.object.userData.id)
        onSelect?.(hit.object.userData.id)
      }
    }
    requestFrame()
  }
  const motionChanged = (event: MediaQueryListEvent) => {
    reduced = event.matches
    velocity = 0
    requestFrame()
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(frame)
    frame = 0
    onUnavailable()
  }

  const events: [string, (event: PointerEvent) => void][] = [
    ['pointerdown', pointerDown],
    ['pointermove', pointerMove],
    ['pointerup', pointerEnd],
    ['pointercancel', pointerEnd],
    ['lostpointercapture', pointerEnd],
    ['webglcontextlost', contextLost],
  ]
  events.forEach(([name, handler]) => canvas.addEventListener(name, handler as EventListener))
  motion.addEventListener('change', motionChanged)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  return {
    select,
    setTyping(id) {
      typing = id !== null && byId.has(id) ? id : null
      typingUntil = performance.now() + 900
      requestFrame()
    },
    pulse(id) {
      const node = byId.get(id)
      if (node) {
        node.pulseAt = performance.now()
        requestFrame()
      }
    },
    rotateBy(radians) {
      if (Number.isFinite(radians)) {
        targetAngle += radians
        velocity = 0
        requestFrame()
      }
    },
    updateColors(next) {
      if (disposed) return
      colors = { ...colors, ...next }
      glass.color.set(colors.ring)
      chrome.color.set(colors.ring)
      platformMaterial.color.set(colors.platform)
      updateEnvironment()
      requestFrame()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      motion.removeEventListener('change', motionChanged)
      events.forEach(([name, handler]) =>
        canvas.removeEventListener(name, handler as EventListener),
      )
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id)
      geometries.forEach((value) => value.dispose())
      materials.forEach((value) => value.dispose())
      environmentTarget?.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
