import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Texture } from 'three'
import logoUrl from './assets/sk-hynix-ci.jpg'

export const createCampusIdentity = (onReady: () => void) => {
  const group = new Group()
  group.name = 'official-sk-hynix-building-identity'
  const image = new Image()
  const texture = new Texture<HTMLImageElement | HTMLCanvasElement>(image)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  const surface = new MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true })
  const sign = new Mesh(new PlaneGeometry(4.1, 4.1 * (270 / 480)), surface)
  sign.position.set(-3, 9.8, -0.45)
  sign.visible = false
  group.add(sign)

  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (context) {
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < pixels.data.length; i += 4) {
        const white = Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2])
        pixels.data[i + 3] = 255 - Math.max(0, Math.min(255, (white - 230) * 10.2))
      }
      context.putImageData(pixels, 0, 0)
      texture.image = canvas
    }
    texture.needsUpdate = true
    sign.visible = true
    onReady()
  }
  image.src = logoUrl

  return {
    group,
    dispose: () => {
      image.onload = null
      image.onerror = null
      image.removeAttribute('src')
    },
  }
}
