import type { TerrainDef } from '@/types/content'
import { lerp, smoothMax, smoothMin } from '@/utils/math'
import { randRange, type Rng } from '@/utils/random'

export interface Crater {
  x: number
  z: number
  radius: number
  /** Height scale of the bowl, meters. */
  depth: number
  /** Floor level in bowl units: -1 is a pure parabola, closer to 0 is flatter. */
  floor: number
  /** 0 = old and eroded, 1 = fresh. */
  freshness: number
  /** Rim irregularity as [amplitude, phase] pairs for four harmonics. */
  rim: Float32Array
  /** Central peak height, meters (0 for small, simple craters). */
  peak: number
  /** Brightness of ejecta rays, 0..1 (0 for old or tiny craters). */
  rays: number
  rayCount: number
  rayPhase: number
  /** Distance from the centre beyond which the crater has no effect, meters. */
  reach: number
}

/** What a crater writes into a terrain sample. */
export interface CraterAccumulator {
  height: number
  /** 0..1, how deep inside a crater bowl the point lies. */
  craterInterior: number
  /** 0..1, closeness to a crater rim crest. */
  craterRim: number
  /** 0..1, bright ejecta deposited around fresh craters. */
  ejecta: number
}

/** Rim falloff width beyond the crest, in crater radii. */
const RIM_WIDTH = 0.6
const RIM_STEEPNESS = 1.1
/** How far ejecta rays extend, in crater radii. */
const RAY_REACH = 3.2

export function createCrater(x: number, z: number, radius: number, freshness: number, rng: Rng): Crater {
  const rim = new Float32Array(8)
  for (let i = 0; i < 4; i++) {
    rim[i * 2] = randRange(rng, 0.015, 0.06) / (1 + i * 0.6)
    rim[i * 2 + 1] = rng() * Math.PI * 2
  }
  const rays = radius >= 6 && freshness > 0.7 ? (freshness - 0.7) / 0.3 : 0
  return {
    x,
    z,
    radius,
    depth: radius * (0.12 + 0.14 * freshness) * randRange(rng, 0.85, 1.15),
    floor: -lerp(0.5, 0.85, freshness),
    freshness,
    rim,
    peak: radius > 55 ? radius * randRange(rng, 0.04, 0.08) : 0,
    rays,
    rayCount: 5 + Math.floor(rng() * 5),
    rayPhase: rng() * Math.PI * 2,
    // 1.1 covers the rim wobble.
    reach: radius * (rays > 0 ? RAY_REACH : 1 + RIM_WIDTH) * 1.1,
  }
}

/**
 * Adds one crater's contribution at (x, z): a bowl with a flattened floor, a raised rim that
 * blends smoothly into the surrounding ground, an optional central peak, and ejecta rays (colour
 * only). Profile after Sebastian Lague's smooth-min crater formulation.
 */
export function sampleCrater(c: Crater, x: number, z: number, out: CraterAccumulator): void {
  const dx = x - c.x
  const dz = z - c.z
  const d2 = dx * dx + dz * dz
  if (d2 >= c.reach * c.reach) return

  const angle = Math.atan2(dz, dx)
  const h = c.rim
  const wobble =
    1 +
    h[0] * Math.sin(2 * angle + h[1]) +
    h[2] * Math.sin(3 * angle + h[3]) +
    h[4] * Math.sin(5 * angle + h[5]) +
    h[6] * Math.sin(8 * angle + h[7])
  const r = Math.sqrt(d2) / (c.radius * wobble)

  if (r < 1 + RIM_WIDTH) {
    const softness = 0.18 + 0.3 * (1 - c.freshness)
    const bowl = smoothMax(r * r - 1, c.floor, softness)
    const rimX = Math.min(r - 1 - RIM_WIDTH, 0)
    out.height += smoothMin(bowl, RIM_STEEPNESS * rimX * rimX, softness) * c.depth
    if (c.peak > 0) out.height += c.peak * Math.exp(-(r * r) / 0.035)
    if (r < 1) out.craterInterior = Math.max(out.craterInterior, 1 - r * r)
    const crest = Math.exp(-(((r - 1.05) / 0.22) ** 2))
    out.craterRim = Math.max(out.craterRim, crest * Math.min(1, c.radius / 15))
  }

  if (c.rays > 0 && r > 0.85) {
    const fade = Math.min(1, Math.exp(-(r - 1) * 1.3))
    const streak = Math.max(0, Math.sin(angle * c.rayCount + c.rayPhase) * Math.sin(angle * (c.rayCount + 3) - c.rayPhase))
    out.ejecta = Math.max(out.ejecta, c.rays * fade * (0.3 + 0.7 * streak ** 3))
  }
}

/** Places landmark craters, then scatters each tier with a size distribution skewed small. */
export function generateCraters(
  def: TerrainDef,
  keepClear: { x: number; z: number; radius: number },
  rng: Rng,
): Crater[] {
  const craters = def.landmarks.map((l) => createCrater(l.x, l.z, l.radius, l.freshness, rng))
  for (const tier of def.craterTiers) {
    for (let placed = 0, attempts = 0; placed < tier.count && attempts < tier.count * 25; attempts++) {
      const radius = tier.minRadius * (tier.maxRadius / tier.minRadius) ** (rng() ** 2)
      const x = randRange(rng, -tier.spread, tier.spread)
      const z = randRange(rng, -tier.spread, tier.spread)
      if (Math.hypot(x - keepClear.x, z - keepClear.z) < keepClear.radius + radius * 1.6) continue
      // Keep landmark craters readable: no large craters punched into their bowls.
      const hidesLandmark = def.landmarks.some(
        (l) => Math.hypot(x - l.x, z - l.z) < l.radius * 0.9 && radius > l.radius * 0.2,
      )
      if (hidesLandmark) continue
      craters.push(createCrater(x, z, radius, rng() ** 2.2, rng))
      placed++
    }
  }
  return craters
}

/** Spatial hash so a terrain sample only visits craters that can affect it. */
export function createCraterLookup(craters: readonly Crater[], cellSize: number) {
  const cells = new Map<number, Crater[]>()
  const key = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768)
  for (const c of craters) {
    const x0 = Math.floor((c.x - c.reach) / cellSize)
    const x1 = Math.floor((c.x + c.reach) / cellSize)
    const z0 = Math.floor((c.z - c.reach) / cellSize)
    const z1 = Math.floor((c.z + c.reach) / cellSize)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz)
        const cell = cells.get(k)
        if (cell) cell.push(c)
        else cells.set(k, [c])
      }
    }
  }
  const none: readonly Crater[] = []
  return (x: number, z: number): readonly Crater[] =>
    cells.get(key(Math.floor(x / cellSize), Math.floor(z / cellSize))) ?? none
}
