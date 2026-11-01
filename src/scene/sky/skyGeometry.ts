import { BufferAttribute, BufferGeometry, Color, SphereGeometry, Vector3 } from 'three'
import { smoothstep } from '@/utils/math'
import { createNoise3D, fbm3 } from '@/utils/noise'
import { createRng, randRange } from '@/utils/random'

/** Normal of the Milky Way's plane: the band rises from the northern horizon and arcs overhead. */
const GALACTIC_POLE = new Vector3(0.842, 0.49, 0.227).normalize()

const STAR_TINTS = [
  { share: 0.15, color: new Color(0.72, 0.82, 1) },
  { share: 0.6, color: new Color(1, 1, 1) },
  { share: 0.18, color: new Color(1, 0.9, 0.78) },
  { share: 0.07, color: new Color(1, 0.76, 0.56) },
]

/** Stars on a sphere of `radius`: mostly dim and small, a few bright, concentrated toward the Milky Way. */
export function createStarGeometry(count: number, radius: number, seed: number): BufferGeometry {
  const rng = createRng(seed)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const u = new Vector3(0, 1, 0).cross(GALACTIC_POLE).normalize()
  const w = new Vector3().crossVectors(GALACTIC_POLE, u)
  const dir = new Vector3()

  for (let i = 0; i < count; i++) {
    if (rng() < 0.35) {
      // In the galactic band: Gaussian latitude around the plane.
      const lon = rng() * Math.PI * 2
      const lat = 0.13 * Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(Math.PI * 2 * rng())
      dir
        .copy(u)
        .multiplyScalar(Math.cos(lat) * Math.cos(lon))
        .addScaledVector(w, Math.cos(lat) * Math.sin(lon))
        .addScaledVector(GALACTIC_POLE, Math.sin(lat))
    } else {
      const y = rng() * 2 - 1
      const r = Math.sqrt(1 - y * y)
      const lon = rng() * Math.PI * 2
      dir.set(r * Math.cos(lon), y, r * Math.sin(lon))
    }
    positions.set([dir.x * radius, dir.y * radius, dir.z * radius], i * 3)

    const bright = rng() < 0.012
    const brightness = bright ? randRange(rng, 1.4, 2.2) : 0.18 + 0.85 * rng() ** 3
    sizes[i] = bright ? randRange(rng, 3.2, 4.6) : 1.1 + 2.1 * rng() ** 4
    let pick = rng()
    const tint = STAR_TINTS.find((t) => (pick -= t.share) < 0) ?? STAR_TINTS[1]
    colors.set([tint.color.r * brightness, tint.color.g * brightness, tint.color.b * brightness], i * 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  return geometry
}

/**
 * Sky dome with colours baked per vertex: near-black navy overhead, slightly lifted at the
 * horizon, with a faint mottled Milky Way band. Baking keeps the fragment cost at zero.
 */
export function createSkyDomeGeometry(radius: number, seed: number): BufferGeometry {
  const geometry = new SphereGeometry(radius, 96, 48)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const noise = createNoise3D(createRng(seed))
  const zenith = new Color('#020309')
  const horizon = new Color('#0a1022')
  const milkyWay = new Color('#2a3352')
  const dust = new Color('#06080f')
  const color = new Color()
  const dir = new Vector3()

  for (let i = 0; i < position.count; i++) {
    dir.fromBufferAttribute(position, i).normalize()
    color.copy(horizon).lerp(zenith, smoothstep(-0.05, 0.55, dir.y))
    const lat = Math.asin(dir.dot(GALACTIC_POLE))
    const band = Math.exp(-((lat / 0.2) ** 2))
    const clouds = 0.5 + 0.5 * fbm3(noise, dir.x * 3, dir.y * 3, dir.z * 3, 4)
    const lanes = smoothstep(0.1, 0.5, fbm3(noise, dir.x * 7 + 9, dir.y * 7, dir.z * 7, 3))
    color.lerp(milkyWay, band * clouds * 0.75).lerp(dust, band * lanes * 0.5)
    colors.set([color.r, color.g, color.b], i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}
