import type { RegionDef } from '@/types/content'
import { clamp, smoothstep } from '@/utils/math'
import { createNoise2D } from '@/utils/noise'
import { createRng, deriveSeed, randRange, type Rng } from '@/utils/random'
import { createSample, SPAWN_CLEAR_RADIUS, type Terrain } from './terrain'

export type RockClass = 'debris' | 'medium' | 'boulder'

export const ROCK_CLASSES: readonly RockClass[] = ['debris', 'medium', 'boulder']

/** Distinct rock shapes per class. */
export const ROCK_VARIANTS = 3

export interface RockPlacement {
  x: number
  y: number
  z: number
  /** Euler angles in radians, applied in 'XZY' order so yaw spins the rock about its own up axis. */
  pitch: number
  yaw: number
  roll: number
  sx: number
  sy: number
  sz: number
  variant: number
  /** Brightness multiplier for colour variation. */
  shade: number
}

export type RockField = Record<RockClass, RockPlacement[]>

const SIZE: Record<RockClass, [number, number]> = {
  debris: [0.12, 0.42],
  medium: [0.45, 1.3],
  boulder: [1.6, 4.2],
}

/** Fraction of a rock's height pushed below the surface. */
const SINK: Record<RockClass, number> = { debris: 0.08, medium: 0.12, boulder: 0.2 }

/** Clearance around the spawn point per class, meters. */
const SPAWN_CLEARANCE: Record<RockClass, number> = {
  debris: 3,
  medium: SPAWN_CLEAR_RADIUS * 0.75,
  boulder: SPAWN_CLEAR_RADIUS,
}

/**
 * Deterministically scatters rocks over the playable area. Boulders and medium rocks depend only
 * on the region (they will become obstacles); `debrisDensity` scales only decorative debris.
 */
export function scatterRocks(terrain: Terrain, region: RegionDef, debrisDensity: number): RockField {
  const field: RockField = { debris: [], medium: [], boulder: [] }
  const { rocks: def, terrain: { seed } } = region
  const half = terrain.playableHalfSize
  const sample = createSample()
  const patches = createNoise2D(createRng(deriveSeed(seed, 'rock-patches')))

  const nearSpawn = (cls: RockClass, x: number, z: number) =>
    Math.hypot(x - terrain.spawn.x, z - terrain.spawn.z) < SPAWN_CLEARANCE[cls]

  const place = (cls: RockClass, rng: Rng, x: number, z: number, scale: number, tall = false) => {
    if (nearSpawn(cls, x, z)) return
    const [nx, ny, nz] = terrain.normalAt(x, z)
    const [min, max] = SIZE[cls]
    const size = randRange(rng, min, max) * scale
    const sy = size * (tall ? randRange(rng, 1.5, 2.6) : randRange(rng, 0.55, 1))
    terrain.sample(x, z, sample)
    field[cls].push({
      x,
      y: sample.height - sy * SINK[cls],
      z,
      // Lean with the slope, plus a little random tilt.
      pitch: Math.atan2(nz, ny) * 0.7 + randRange(rng, -0.14, 0.14),
      yaw: rng() * Math.PI * 2,
      roll: -Math.atan2(nx, ny) * 0.7 + randRange(rng, -0.14, 0.14),
      sx: size * randRange(rng, 0.8, 1.3),
      sy,
      sz: size * randRange(rng, 0.8, 1.3),
      variant: Math.floor(rng() * ROCK_VARIANTS),
      shade: randRange(rng, 0.84, 1.08) * (1 - 0.14 * sample.craterInterior) + 0.08 * sample.ejecta,
    })
  }

  // Rocks gather in patches, on crater rims and in fresh ejecta.
  const acceptance = (x: number, z: number) => {
    terrain.sample(x, z, sample)
    const patch = smoothstep(-0.35, 0.6, patches(x / 70, z / 70))
    return clamp(0.2 + 0.55 * patch + 0.5 * sample.craterRim + 0.6 * sample.ejecta, 0, 1)
  }

  const scatter = (cls: RockClass, rng: Rng, perHundredSqm: number, spread: number) => {
    const candidates = Math.round(((spread * 2) ** 2 / 100) * perHundredSqm)
    for (let i = 0; i < candidates; i++) {
      const x = randRange(rng, -spread, spread)
      const z = randRange(rng, -spread, spread)
      if (rng() < acceptance(x, z)) place(cls, rng, x, z, 1)
    }
  }

  // Separate random streams, so changing debris density never moves gameplay-relevant rocks.
  const boulderRng = createRng(deriveSeed(seed, 'boulders'))
  for (const crater of terrain.craters) {
    if (crater.radius < 12) continue
    if (Math.abs(crater.x) > half + crater.radius || Math.abs(crater.z) > half + crater.radius) continue
    const count = Math.round(def.rimBoulders * (crater.radius / 10) * randRange(boulderRng, 0.6, 1.4))
    const scale = clamp(crater.radius / 30, 0.5, 1.4)
    for (let i = 0; i < count; i++) {
      const angle = boulderRng() * Math.PI * 2
      const dist = crater.radius * randRange(boulderRng, 0.92, 1.3)
      const x = crater.x + Math.cos(angle) * dist
      const z = crater.z + Math.sin(angle) * dist
      if (Math.abs(x) > half || Math.abs(z) > half) continue
      place('boulder', boulderRng, x, z, scale)
      // Occasionally a formation: a cluster of tall slabs thrown up by the impact.
      if (boulderRng() < 0.3) {
        const slabs = 1 + Math.floor(boulderRng() * 3)
        for (let k = 0; k < slabs; k++) {
          const ox = randRange(boulderRng, -3, 3) * scale
          const oz = randRange(boulderRng, -3, 3) * scale
          place('boulder', boulderRng, x + ox, z + oz, scale * 0.75, true)
        }
      }
    }
  }
  scatter('boulder', boulderRng, def.boulderDensity, half * 1.15)
  scatter('medium', createRng(deriveSeed(seed, 'medium-rocks')), def.mediumDensity, half * 1.15)
  scatter('debris', createRng(deriveSeed(seed, 'debris')), def.debrisDensity * debrisDensity, half)
  return field
}
