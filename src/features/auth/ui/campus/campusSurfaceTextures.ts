import * as THREE from 'three'

const randomSequence = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0
  return (seed >>> 0) / 4294967296
}

export const createSurfaceTexture = (surface: 'asphalt' | 'paving' | 'concrete') => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Campus surface canvas is unavailable')
  const random = randomSequence(surface.length * 919)
  const image = context.createImageData(512, 512)
  const colors = {
    asphalt: [76, 81, 84],
    paving: [176, 178, 172],
    concrete: [216, 219, 216],
  }
  const base = colors[surface]
  for (let i = 0; i < image.data.length; i += 4) {
    const variation = (random() - 0.5) * (surface === 'asphalt' ? 35 : 14)
    image.data[i] = base[0] + variation
    image.data[i + 1] = base[1] + variation
    image.data[i + 2] = base[2] + variation
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  if (surface === 'paving') {
    for (let row = 0; row < 4; row++) {
      for (let col = -1; col < 4; col++) {
        const x = col * 256 + (row % 2) * 128
        const y = row * 128
        context.fillStyle = `rgba(255,255,255,${random() * 0.065})`
        context.fillRect(x + 2, y + 2, 252, 124)
        context.strokeStyle = 'rgba(60,65,62,0.23)'
        context.lineWidth = 2
        context.strokeRect(x + 1, y + 1, 254, 126)
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

export const createFoliageTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Campus foliage canvas is unavailable')
  const random = randomSequence(3271)
  context.strokeStyle = '#64713d'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(124, 251)
  context.quadraticCurveTo(147, 132, 111, 21)
  context.stroke()
  for (let i = 0; i < 68; i++) {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random()) * 103
    const x = 128 + Math.cos(angle) * radius * 0.86
    const y = 128 + Math.sin(angle) * radius
    const lightness = 29 + random() * 26
    context.strokeStyle = '#68703b'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(126, y + 17)
    context.lineTo(x, y)
    context.stroke()
    context.save()
    context.translate(x, y)
    context.rotate(angle + random())
    context.fillStyle = `hsl(${81 + random() * 20} 29% ${lightness}%)`
    context.beginPath()
    context.moveTo(-14, 0)
    context.quadraticCurveTo(0, -10, 17, 0)
    context.quadraticCurveTo(0, 10, -14, 0)
    context.fill()
    context.restore()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
