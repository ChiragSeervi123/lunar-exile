import { MINING } from '@/config/mining'
import { PLAYER_CONTROLLER } from '@/config/player'
import { RARITIES } from '@/data/rarities'
import { getResource } from '@/data/resources'
import { createSample, scatterRocks, type Terrain, type TerrainSample } from '@/game/world'
import type { DepositShape, Habitat, RegionDef } from '@/types/content'
import { clamp, DEG2RAD, lerp, smoothstep } from '@/utils/math'
import { createRng, deriveSeed, randRange } from '@/utils/random'

/** A mineable deposit placed in the world. Everything here is fixed for a given world seed. */
export interface Deposit {
  /** Stable across sessions: `${regionId}:${resourceId}:${index}`. */
  id: string
  resourceId: string
  /** Base point, on the ground. */
  x: number
  y: number
  z: number
  /** Euler angles in radians, applied in 'XZY' order like rocks: a lean with the slope, then a spin. */
  pitch: number
  yaw: number
  roll: number
  /**
   * On the Moon: the full orientation as a quaternion (x, y, z, w), which replaces the Euler
   * angles; the position is then world space, with the Moon's centre at the origin.
   */
  orientation?: [number, number, number, number]
  /** Size multiplier within the resource's appearance range. */
  size: number
  maxHealth: number
  /** Units released when mined out; the same every time this deposit is mined. */
  yield: number
}

/**
 * Footprint radius and height of each shape at size 1, meters. Placement keeps footprints apart,
 * collision boxes are fitted to them, and the renderer builds shapes to match.
 */
export const DEPOSIT_BOUNDS: Record<DepositShape, { radius: number; height: number }> = {
  patch: { radius: 0.8, height: 0.35 },
  blocks: { radius: 0.65, height: 0.75 },
  vein: { radius: 0.7, height: 0.95 },
  crystals: { radius: 0.6, height: 0.85 },
  spires: { radius: 0.85, height: 2.1 },
  relic: { radius: 1.1, height: 1.6 },
}

/** Shapes low enough to walk over; everything else blocks the astronaut like a rock. */
const FLAT_SHAPES: readonly DepositShape[] = ['patch']
/** Kept between deposits and solid rocks, meters. */
export const ROCK_GAP = 1

/** A deposit's collision box in its own frame: half extents, and the centre's height above the base. */
export interface DepositBox {
  halfExtents: [number, number, number]
  centerY: number
  /** Blocks movement; otherwise it is only there to be aimed at. */
  solid: boolean
}

export function depositBox(deposit: Deposit, shape: DepositShape): DepositBox {
  const { radius, height } = DEPOSIT_BOUNDS[shape]
  const solid = !FLAT_SHAPES.includes(shape)
  const r = radius * deposit.size * 0.8
  // A flat patch gets a taller box than it looks, so the coarse terrain collider never covers it.
  const top = Math.max(height * deposit.size, solid ? 0 : 0.45)
  const bottom = -0.25
  return { halfExtents: [r, (top - bottom) / 2, r], centerY: (top + bottom) / 2, solid }
}

/** Box around ore left on the ground after a deposit breaks, in the deposit's frame. */
export const DROP_BOX: DepositBox = { halfExtents: [0.45, 0.35, 0.45], centerY: 0.2, solid: false }

/** How well a terrain sample suits a habitat, 0..1. */
export function habitatFit(habitat: Habitat, s: TerrainSample): number {
  switch (habitat) {
    case 'plains':
      return clamp(1 - 0.8 * s.craterInterior - 0.6 * s.craterRim, 0, 1)
    case 'mare':
      // Titanium-bearing ilmenite is found in the dark basalt of the maria.
      return smoothstep(0.75, 0.25, s.albedo)
    case 'crater-floor':
      // Cold crater floors trap volatiles such as helium-3.
      return smoothstep(0.2, 0.6, s.craterInterior)
    case 'crater-rim':
      return clamp(s.craterRim * 1.4 + s.ejecta, 0, 1)
  }
}

/** Occupied circles on the ground, bucketed so overlap tests only look at nearby cells. */
function createFootprints(cellSize: number) {
  const cells = new Map<number, { x: number; z: number; r: number }[]>()
  const key = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768)
  return {
    add(x: number, z: number, r: number) {
      const k = key(Math.floor(x / cellSize), Math.floor(z / cellSize))
      const cell = cells.get(k)
      if (cell) cell.push({ x, z, r })
      else cells.set(k, [{ x, z, r }])
    },
    /** True if a circle at (x, z) of radius r overlaps anything added. Radii must stay below the cell size. */
    overlaps(x: number, z: number, r: number) {
      const cx = Math.floor(x / cellSize)
      const cz = Math.floor(z / cellSize)
      for (let i = cx - 1; i <= cx + 1; i++) {
        for (let j = cz - 1; j <= cz + 1; j++) {
          for (const c of cells.get(key(i, j)) ?? []) {
            if (Math.hypot(c.x - x, c.z - z) < c.r + r) return true
          }
        }
      }
      return false
    },
  }
}

/**
 * Places the region's deposits on its playable terrain. Each type favours its habitat (titanium in
 * dark mare, helium-3 and relics in crater floors, crystals and compacted regolith on rims), avoids
 * the landing zone, steep slopes, solid rocks and other deposits, and appears in proportion to its
 * density. Rarer types are placed first so they get the best ground. Deterministic for a seed.
 */
export function scatterDeposits(regionId: string, region: RegionDef, terrain: Terrain): Deposit[] {
  const deposits: Deposit[] = []
  const seed = region.terrain.seed
  const hectares = (terrain.playableHalfSize * 2) ** 2 / 10_000
  // Inside the walkable edge, with room for the deposit itself.
  const half = terrain.playableHalfSize - PLAYER_CONTROLLER.boundaryMargin - 3
  const minNormalY = Math.cos(MINING.maxSlope * DEG2RAD)
  const sample = createSample()

  const rocks = createFootprints(32)
  const field = scatterRocks(terrain, region, 0)
  // Rock shapes are unit icosahedra stretched up to 1.3x, so this bounds their reach.
  for (const rock of [...field.medium, ...field.boulder]) rocks.add(rock.x, rock.z, Math.max(rock.sx, rock.sz) * 1.3)
  const placed = createFootprints(16)

  const nodes = region.resourceNodes
    .map((node) => ({ ...node, def: getResource(node.resourceId) }))
    .filter((node) => node.def !== undefined)
    .sort((a, b) => RARITIES[b.def!.rarity].rank - RARITIES[a.def!.rarity].rank || a.resourceId.localeCompare(b.resourceId))

  for (const { resourceId, density, def } of nodes) {
    if (!def) continue
    const rng = createRng(deriveSeed(seed, `deposits:${resourceId}`))
    const wanted = Math.max(1, Math.round(density * hectares))
    const bounds = DEPOSIT_BOUNDS[def.appearance.shape]
    const [minSize, maxSize] = def.appearance.size
    let count = 0
    for (let attempt = 0; count < wanted && attempt < wanted * 400; attempt++) {
      const x = randRange(rng, -half, half)
      const z = randRange(rng, -half, half)
      const size = randRange(rng, minSize, maxSize)
      const radius = bounds.radius * size
      if (Math.hypot(x - terrain.spawn.x, z - terrain.spawn.z) < MINING.clearRadius + radius) continue
      terrain.sample(x, z, sample)
      // A small floor keeps every type possible outside its favourite habitat, just much less likely.
      if (rng() > 0.03 + 0.97 * habitatFit(def.habitat, sample)) continue
      const [nx, ny, nz] = terrain.normalAt(x, z)
      if (ny < minNormalY) continue
      if (rocks.overlaps(x, z, radius + ROCK_GAP) || placed.overlaps(x, z, radius + MINING.minSpacing)) continue

      placed.add(x, z, radius)
      const t = (size - minSize) / Math.max(1e-6, maxSize - minSize)
      deposits.push({
        id: `${regionId}:${resourceId}:${count}`,
        resourceId,
        x,
        y: sample.height,
        z,
        pitch: Math.atan2(nz, ny) * 0.6,
        yaw: rng() * Math.PI * 2,
        roll: -Math.atan2(nx, ny) * 0.6,
        size,
        maxHealth: Math.round(def.health * lerp(0.8, 1.25, t)),
        // Bigger deposits tend to give more, with some luck either way.
        yield: Math.round(lerp(def.yield.min, def.yield.max, clamp(t * 0.6 + rng() * 0.4, 0, 1))),
      })
      count++
    }
  }
  return deposits
}
