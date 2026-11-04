import { createCrater, sampleCrater, type Crater, type CraterAccumulator } from '@/game/world'
import { createRng, deriveSeed, type Rng } from '@/utils/random'
import { cross, dot, normalize, setVec, vec3, type Vec3 } from '@/utils/vec3'

/** A crater on the sphere: the flat-map crater profile, applied in the tangent plane at its centre. */
export interface SphereCrater {
  /** Profile, centred on its own origin. */
  crater: Crater
  /** Centre on the datum sphere, meters from the Moon's centre. */
  center: Vec3
  /** Tangent axes at the centre: the profile's x and z. */
  e1: Vec3
  e2: Vec3
}

/** Builds a crater centred on a unit direction, with its profile drawn from `rng`. */
export function createSphereCrater(dir: Vec3, radius: number, sphereRadius: number, freshness: number, rng: Rng): SphereCrater {
  const center = vec3(dir.x * sphereRadius, dir.y * sphereRadius, dir.z * sphereRadius)
  const helper = Math.abs(dir.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)
  const e1 = normalize(vec3(), cross(vec3(), helper, dir))
  const e2 = cross(vec3(), dir, e1)
  return { crater: createCrater(0, 0, radius, freshness, rng), center, e1, e2 }
}

const local = vec3()

/** Adds one sphere crater's effect at datum point `pos`. */
export function sampleSphereCrater(c: SphereCrater, pos: Vec3, out: CraterAccumulator): void {
  const dx = pos.x - c.center.x
  const dy = pos.y - c.center.y
  const dz = pos.z - c.center.z
  const reach = c.crater.reach
  if (dx * dx + dy * dy + dz * dz >= reach * reach) return
  setVec(local, dx, dy, dz)
  sampleCrater(c.crater, dot(local, c.e1), dot(local, c.e2), out)
}

interface Tier {
  minRadius: number
  maxRadius: number
  /** Cell edge, meters: at least twice the largest crater's reach, so a 3×3×3 search finds every crater. */
  cell: number
  /** Craters per cell where density is 1 (the landing site's). */
  perCell: number
}

/**
 * Crater sizes, matching the landing site's mix: many small pits, fewer mid-size craters and a
 * rare large one. Larger landmark craters and the giant basin are placed separately.
 */
const TIERS: Tier[] = [
  { minRadius: 2.5, maxRadius: 11, cell: 80, perCell: 2.42 },
  { minRadius: 12, maxRadius: 40, cell: 300, perCell: 0.98 },
  { minRadius: 45, maxRadius: 115, cell: 820, perCell: 0.22 },
]
/** Cached cells per tier; regions explored long ago are dropped and regenerated identically if revisited. */
const CACHE_SIZE = 4096

export interface SphereCraterField {
  /**
   * Adds every crater affecting datum point `pos` (unit direction × radius). Sampled `spacing`
   * meters apart, size tiers whose largest crater is smaller than that spacing are skipped.
   */
  sample(pos: Vec3, out: CraterAccumulator, spacing?: number): void
}

/**
 * Craters over the whole sphere without storing them all: space is cut into cubic cells per size
 * tier, and each cell near the surface seeds its own craters from its coordinates, so any region
 * is generated on demand and identically every time. Density follows `densityAt` (1 = the landing
 * site's), up to `maxDensity`.
 */
export function createSphereCraterField(
  seed: number,
  sphereRadius: number,
  densityAt: (dir: Vec3) => number,
  maxDensity: number,
  landmarks: readonly SphereCrater[],
): SphereCraterField {
  const dir = vec3()

  const cellCraters = TIERS.map(() => new Map<number, SphereCrater[]>())
  const neighbourhoods = TIERS.map(() => new Map<number, SphereCrater[]>())
  const key = (ix: number, iy: number, iz: number) => ((ix + 512) * 1024 + (iy + 512)) * 1024 + (iz + 512)
  const remember = <T>(cache: Map<number, T>, k: number, value: T) => {
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!)
    cache.set(k, value)
    return value
  }

  /** The craters seeded by one cell (centres projected onto the sphere from inside it). */
  const generate = (t: number, ix: number, iy: number, iz: number): SphereCrater[] => {
    const k = key(ix, iy, iz)
    const cached = cellCraters[t].get(k)
    if (cached) return cached
    const tier = TIERS[t]
    const c = tier.cell
    const list: SphereCrater[] = []
    // Only cells near the surface can seed craters (a cell reaches √3/2 of its edge from its centre).
    const cx = (ix + 0.5) * c
    const cy = (iy + 0.5) * c
    const cz = (iz + 0.5) * c
    if (Math.abs(Math.sqrt(cx * cx + cy * cy + cz * cz) - sphereRadius) < c * 1.4) {
      const rng = createRng(deriveSeed(seed, `craters:${t}:${ix}:${iy}:${iz}`))
      const expected = tier.perCell * maxDensity
      const count = Math.floor(expected) + (rng() < expected % 1 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const px = (ix + rng()) * c
        const py = (iy + rng()) * c
        const pz = (iz + rng()) * c
        const keep = rng()
        const sizeRoll = rng()
        const freshness = rng() ** 2.2
        const r = Math.sqrt(px * px + py * py + pz * pz)
        // A shell one cell thick around the surface holds, on average, one point per cell² of area.
        if (Math.abs(r - sphereRadius) > c / 2) continue
        setVec(dir, px / r, py / r, pz / r)
        if (keep * maxDensity > densityAt(dir)) continue
        const radius = tier.minRadius * (tier.maxRadius / tier.minRadius) ** (sizeRoll * sizeRoll)
        list.push(createSphereCrater(dir, radius, sphereRadius, freshness, rng))
      }
    }
    return remember(cellCraters[t], k, list)
  }

  /** Every crater that can reach into cell (ix, iy, iz), from it and its 26 neighbours. */
  const neighbourhood = (t: number, ix: number, iy: number, iz: number): SphereCrater[] => {
    const k = key(ix, iy, iz)
    const cached = neighbourhoods[t].get(k)
    if (cached) return cached
    const c = TIERS[t].cell
    const list: SphereCrater[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const crater of generate(t, ix + dx, iy + dy, iz + dz)) {
            // Distance from the crater centre to this cell's box.
            const ex = Math.max(ix * c - crater.center.x, 0, crater.center.x - (ix + 1) * c)
            const ey = Math.max(iy * c - crater.center.y, 0, crater.center.y - (iy + 1) * c)
            const ez = Math.max(iz * c - crater.center.z, 0, crater.center.z - (iz + 1) * c)
            if (ex * ex + ey * ey + ez * ez < crater.crater.reach ** 2) list.push(crater)
          }
        }
      }
    }
    return remember(neighbourhoods[t], k, list)
  }

  // Consecutive samples (a chunk's grid) nearly always stay in the same cell: remember the last one.
  const lastKey = TIERS.map(() => Number.NaN)
  const lastList: SphereCrater[][] = TIERS.map(() => [])

  return {
    sample(pos, out, spacing = 0) {
      for (let t = 0; t < TIERS.length; t++) {
        if (TIERS[t].maxRadius < spacing) continue
        const c = TIERS[t].cell
        const ix = Math.floor(pos.x / c)
        const iy = Math.floor(pos.y / c)
        const iz = Math.floor(pos.z / c)
        const k = key(ix, iy, iz)
        if (k !== lastKey[t]) {
          lastKey[t] = k
          lastList[t] = neighbourhood(t, ix, iy, iz)
        }
        const list = lastList[t]
        for (let i = 0; i < list.length; i++) sampleSphereCrater(list[i], pos, out)
      }
      for (let i = 0; i < landmarks.length; i++) sampleSphereCrater(landmarks[i], pos, out)
    },
  }
}
