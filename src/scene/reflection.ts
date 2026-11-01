import { CanvasTexture, EquirectangularReflectionMapping, SRGBColorSpace } from 'three'

type Direction = [number, number, number]

/** Equirectangular texture coordinates of a direction, matching three's equirect lookup. */
function equirect(d: Direction): [number, number] {
  const u = Math.atan2(d[2], d[0]) / (Math.PI * 2) + 0.5
  const v = Math.asin(Math.min(1, Math.max(-1, d[1]))) / Math.PI + 0.5
  return [u, 1 - v]
}

/**
 * A tiny painted environment for shiny surfaces to reflect: black sky, the bright regolith horizon,
 * the sun and Earth. Far cheaper than rendering a real environment map.
 */
export function createSkyReflection(sun: Direction, earth: Direction | null): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
    sky.addColorStop(0, '#020309')
    sky.addColorStop(0.47, '#0d1424')
    sky.addColorStop(0.5, '#cbc8c0')
    sky.addColorStop(0.62, '#8e8b85')
    sky.addColorStop(1, '#45433f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const glow = (dir: Direction, radius: number, color: string) => {
      const [u, v] = equirect(dir)
      const x = u * canvas.width
      const y = v * canvas.height
      const spot = ctx.createRadialGradient(x, y, 0, x, y, radius)
      spot.addColorStop(0, color)
      spot.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = spot
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
    glow(sun, 18, 'rgba(255,248,232,1)')
    if (earth) glow(earth, 7, 'rgba(110,165,255,1)')
  }
  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  return texture
}
