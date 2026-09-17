import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  PerspectiveCamera,
  PCFShadowMap,
  PMREMGenerator,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import type { WebGLRenderTarget } from 'three'
import { Sky } from 'three/addons/objects/Sky.js'
import { createCampusEnvironment } from './campusEnvironment'
import { createCampusActors } from './campusActors'
import { createCampusIdentity } from './campusIdentity'
import { createCampusFramePacing } from './campusFramePacing'

export interface CampusRenderer {
  setPlaying: (playing: boolean) => void
  dispose: () => void
}

export const frameCampusCamera = (camera: PerspectiveCamera, aspect: number) => {
  camera.aspect = aspect
  const halfAngle = (43 * Math.PI) / 360
  camera.fov = (Math.atan(Math.tan(halfAngle) * Math.min(1, 1.45 / aspect)) * 360) / Math.PI
  camera.position.set(18, 5.2, 33)
  camera.lookAt(-2, 5, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
}

const disposeScene = (scene: Scene) => {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
    }
    if (object instanceof InstancedMesh) object.dispose()
  })
  for (const geometry of geometries) geometry.dispose()
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
}

export const createCampusRenderer = (
  host: HTMLDivElement,
  onUnavailable: () => void,
): CampusRenderer => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  const context = renderer.getContext() as WebGL2RenderingContext
  const scene = new Scene()
  const camera = new PerspectiveCamera(43, 1, 0.2, 1200)
  const sunlight = new DirectionalLight('#fff3dc', 3.6)
  const canvas = renderer.domElement
  let frame = 0
  let lastFrame = 0
  let elapsed = 9
  let playing = false
  let inView = true
  let disposed = false
  let lost = false
  let width = 0
  let height = 0
  const pacing = createCampusFramePacing()
  let gpuFrame: WebGLSync | null = null
  let observer: ResizeObserver | undefined
  let intersection: IntersectionObserver | undefined
  let environmentMap: WebGLRenderTarget | undefined
  let identity: ReturnType<typeof createCampusIdentity> | undefined

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    lastFrame = 0
    pacing.reset()
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    stop()
    observer?.disconnect()
    intersection?.disconnect()
    document.removeEventListener('visibilitychange', syncPlayback)
    canvas.removeEventListener('webglcontextlost', contextLost)
    identity?.dispose()
    if (gpuFrame) context.deleteSync(gpuFrame)
    gpuFrame = null
    disposeScene(scene)
    environmentMap?.dispose()
    sunlight.shadow.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  const contextLost = (event: Event) => {
    event.preventDefault()
    lost = true
    stop()
    onUnavailable()
  }

  const canAnimate = () =>
    playing && inView && !document.hidden && !disposed && !lost && width > 0 && height > 0

  let animate: FrameRequestCallback

  const syncPlayback = () => {
    if (!canAnimate()) {
      stop()
      return
    }
    if (!frame) {
      pacing.reset()
      frame = requestAnimationFrame(animate)
    }
  }

  try {
    renderer.setClearColor(new Color('#b7d6e6'), 1)
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = PCFShadowMap
    scene.fog = new Fog('#c1d5dc', 45, 130)
    scene.add(new HemisphereLight('#d9edff', '#6e7367', 1.15))
    const sky = new Sky()
    sky.scale.setScalar(500)
    sky.material.uniforms.turbidity.value = 3.5
    sky.material.uniforms.rayleigh.value = 1.8
    sky.material.uniforms.mieCoefficient.value = 0.004
    sky.material.uniforms.mieDirectionalG.value = 0.8
    sky.material.uniforms.sunPosition.value.set(-0.46, 0.72, 0.43)
    sky.material.uniforms.cloudCoverage.value = 0.42
    sky.material.uniforms.cloudDensity.value = 0.5
    const skyScene = new Scene()
    skyScene.add(sky)
    const generator = new PMREMGenerator(renderer)
    try {
      environmentMap = generator.fromScene(skyScene, 0, 0.1, 1000, { size: 256 })
      scene.environment = environmentMap.texture
      scene.environmentIntensity = 0.045
      scene.background = environmentMap.texture
      scene.backgroundIntensity = 0.12
    } finally {
      generator.dispose()
      sky.geometry.dispose()
      sky.material.dispose()
    }
    sunlight.position.set(-18, 28, 18)
    sunlight.castShadow = true
    sunlight.shadow.mapSize.set(1024, 1024)
    sunlight.shadow.camera.left = -24
    sunlight.shadow.camera.right = 24
    sunlight.shadow.camera.top = 22
    sunlight.shadow.camera.bottom = -22
    sunlight.shadow.camera.far = 85
    sunlight.shadow.normalBias = 0.025
    sunlight.shadow.bias = -0.0002
    sunlight.shadow.radius = 2
    scene.add(sunlight)
    scene.add(createCampusEnvironment())
    const actors = createCampusActors()
    scene.add(actors.group)
    actors.update(elapsed)
    canvas.setAttribute('aria-hidden', 'true')
    host.append(canvas)

    const render = () => {
      if (disposed || lost || width < 1 || height < 1) return
      if (gpuFrame) context.deleteSync(gpuFrame)
      pacing.submitted(performance.now())
      renderer.render(scene, camera)
      gpuFrame = context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
      context.flush()
    }

    identity = createCampusIdentity(render)
    scene.add(identity.group)

    animate = (now) => {
      if (!canAnimate()) {
        stop()
        return
      }
      if (gpuFrame) {
        if (context.clientWaitSync(gpuFrame, 0, 0) === context.TIMEOUT_EXPIRED) {
          frame = requestAnimationFrame(animate)
          return
        }
        context.deleteSync(gpuFrame)
        gpuFrame = null
        pacing.completed(performance.now())
      }
      if (!lastFrame || now - lastFrame >= pacing.interval) {
        if (lastFrame) elapsed += (now - lastFrame) / 1000
        lastFrame = now
        actors.update(elapsed)
        render()
      }
      frame = requestAnimationFrame(animate)
    }

    const resize = () => {
      if (disposed || lost) return
      const rect = host.getBoundingClientRect()
      width = Math.round(rect.width)
      height = Math.round(rect.height)
      if (width < 1 || height < 1) {
        syncPlayback()
        return
      }
      const aspect = width / height
      frameCampusCamera(camera, aspect)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1 : 1.25))
      renderer.setSize(width, height, false)
      render()
      syncPlayback()
    }

    observer = new ResizeObserver(resize)
    observer.observe(host)
    intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      syncPlayback()
    })
    intersection.observe(host)
    document.addEventListener('visibilitychange', syncPlayback)
    canvas.addEventListener('webglcontextlost', contextLost)
    resize()

    return {
      setPlaying: (value) => {
        playing = value
        syncPlayback()
      },
      dispose,
    }
  } catch (error) {
    dispose()
    throw error
  }
}
