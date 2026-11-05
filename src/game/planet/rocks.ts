import {
  ROCK_CLASSES,
  ROCK_SCATTER_EXTENT,
  ROCK_SINK,
  ROCK_SIZE,
  ROCK_VARIANTS,
  scatterRocks,
  type RockClass,
  type RockPlacement,
} from '@/game/world'
import type { RegionDef } from '@/types/content'
import { clamp, smoothstep } from '@/utils/math'
import { createSmoothNoise3D } from '@/utils/noise'
import { createRng, deriveSeed } from '@/utils/random'
import { dot, multiplyQuat, quat, quatFromEulerXZY, vec3, type Quat, type Vec3 } from '@/utils/vec3'
import { nodeArea } from './cells'
import { faceDirection, gridParam, type CubeNode } from './cubeSphere'
import { chartCoordinates, chartDirection, chartRotation, createFrame, frameFacing, frameRotation, toLocal, type ChartPoint } from './frame'
import { createPlanetSample, type Planet } from './sampler'

/** A rock on the Moon. Its shape is one of the class's variants, as on the flat map. */
export interface PlanetRock {
  /** The rock's origin, world space: on the ground, sunk a little into it. */
  x: number
  y: number
  z: number
  /** Orientation (quaternion). */
  qx: number
  qy: number
  qz: number
  qw: number
  sx: number
  sy: number
  sz: number
  variant: number
  /** Brightness multiplier for colour variation. */
  shade: number
}

export type PlanetRockSet = Record<RockClass, PlanetRock[]>

/** Rocks are generated per node at this depth (about 86 m across). */
export const ROCK_CELL_DEPTH = 6

/** Highest province rock density (relative to the landing site's) the candidate counts allow for. */
const MAX_DENSITY = 2

export interface PlanetRockField {
  /** The landing site's rocks: the flat map's, placed on the sphere exactly where they were. */
  landing(debrisDensity: number): PlanetRockSet
  /**
   * The rocks of one class in one cell (a node at ROCK_CELL_DEPTH), anywhere on the Moon except
   * inside the landing site's own field. Deterministic: a cell always has the same rocks. Debris
   * scales with `debrisDensity`; solid rocks never depend on it.
   */
  cell(node: CubeNode, cls: RockClass, debrisDensity: number): PlanetRock[]
}

/** A place nothing is scattered on: a unit direction and a radius along the ground, meters. */
export interface ClearZone {
  dir: Vec3
  radius: number
}

/**
 * Rocks for the whole Moon. Around the landing site they come from the flat map, so the rocks of
 * Milestones 1–3 (and the deposits placed around them) stay where they were; everywhere else they
 * gather the same way, in patches, on crater rims and in fresh ejecta, in proportion to each
 * province's rockiness, and keep off `clear` zones (cave mouths, structures).
 */
export function createPlanetRockField(planet: Planet, region: RegionDef, clear: readonly ClearZone[] = []): PlanetRockField {
  const R = planet.radius
  const flat = planet.landing.terrain
  const patches = createSmoothNoise3D(createRng(deriveSeed(planet.seed, 'rock-patches')))
  const sample = createPlanetSample()
  const dir = vec3()
  const normal = vec3()
  const local = vec3()
  const frame = createFrame()
  const pole = vec3(0, 1, 0)
  const qFrame = quat()
  const qLocal = quat()
  const chart: ChartPoint = { x: 0, z: 0, distance: 0 }
  // The landing site's rocks cover a square per class; beyond its corners the Moon's take over.
  const extent = (cls: RockClass) => flat.playableHalfSize * ROCK_SCATTER_EXTENT[cls]
  const nearLanding = Math.cos((flat.playableHalfSize * 1.2 * Math.SQRT2 + 50) / R)

  const toRock = (x: number, y: number, z: number, q: Quat, sx: number, sy: number, sz: number, variant: number, shade: number): PlanetRock => ({
    x,
    y,
    z,
    qx: q.x,
    qy: q.y,
    qz: q.z,
    qw: q.w,
    sx,
    sy,
    sz,
    variant,
    shade,
  })

  const fromFlat = (r: RockPlacement): PlanetRock => {
    chartDirection(r.x, r.z, R, dir)
    // The same height above the ground as on the flat map: exactly where the map is used unchanged,
    // and still resting on the ground where it blends into the Moon.
    const radius = R + planet.heightAt(dir) + (r.y - flat.heightAt(r.x, r.z))
    quatFromEulerXZY(qLocal, r.pitch, r.yaw, r.roll)
    multiplyQuat(qLocal, chartRotation(r.x, r.z, R, qFrame), qLocal)
    return toRock(dir.x * radius, dir.y * radius, dir.z * radius, qLocal, r.sx, r.sy, r.sz, r.variant, r.shade)
  }

  const inLandingField = (cls: RockClass) => {
    if (dir.y < nearLanding) return false
    chartCoordinates(dir, R, chart)
    const e = extent(cls)
    return Math.abs(chart.x) <= e && Math.abs(chart.z) <= e
  }

  const density = (cls: RockClass, debrisDensity: number) => {
    const def = region.rocks
    if (cls === 'boulder') return def.boulderDensity
    if (cls === 'medium') return def.mediumDensity
    return def.debrisDensity * debrisDensity
  }

  return {
    landing(debrisDensity) {
      const field = scatterRocks(flat, region, debrisDensity)
      const out: PlanetRockSet = { debris: [], medium: [], boulder: [] }
      for (const cls of ROCK_CLASSES) for (const r of field[cls]) out[cls].push(fromFlat(r))
      return out
    },

    cell(node, cls, debrisDensity) {
      const rocks: PlanetRock[] = []
      const perHundred = density(cls, debrisDensity)
      if (perHundred <= 0) return rocks
      // One random stream per cell and class: debris density never moves the solid rocks.
      const rng = createRng(deriveSeed(planet.seed, `rocks:${cls}:${node.depth}:${node.face}:${node.ix}:${node.iy}`))
      const expected = (nodeArea(node, R) / 100) * perHundred * MAX_DENSITY
      const count = Math.floor(expected) + (rng() < expected % 1 ? 1 : 0)
      const cells = 2 ** node.depth
      const s0 = gridParam(node.ix, cells)
      const t0 = gridParam(node.iy, cells)
      const span = 2 / cells
      const [minSize, maxSize] = ROCK_SIZE[cls]
      for (let i = 0; i < count; i++) {
        // Every candidate draws the same numbers whether it is kept or not, so rocks never shift.
        const s = s0 + rng() * span
        const t = t0 + rng() * span
        const keep = rng()
        const size = minSize + (maxSize - minSize) * rng()
        const height = 0.55 + 0.45 * rng()
        const tiltX = (rng() - 0.5) * 0.28
        const tiltZ = (rng() - 0.5) * 0.28
        const yaw = rng() * Math.PI * 2
        const sx = size * (0.8 + 0.5 * rng())
        const sz = size * (0.8 + 0.5 * rng())
        const variant = Math.min(ROCK_VARIANTS - 1, Math.floor(rng() * ROCK_VARIANTS))
        const shade = 0.84 + 0.24 * rng()

        faceDirection(node.face, s, t, dir)
        if (inLandingField(cls)) continue
        if (clear.some((z) => dot(z.dir, dir) > Math.cos(z.radius / R))) continue
        planet.sample(dir, sample)
        const patch = smoothstep(-0.35, 0.6, patches((dir.x * R) / 70, (dir.y * R) / 70, (dir.z * R) / 70))
        const accept = clamp(0.2 + 0.55 * patch + 0.5 * sample.craterRim + 0.6 * sample.ejecta, 0, 1) * (Math.min(sample.rocks, MAX_DENSITY) / MAX_DENSITY)
        if (keep >= accept) continue

        // Lean with the slope (in the ground's own frame, as on the flat map), plus a little random tilt.
        planet.normalAt(dir, normal)
        frameFacing(frame, dir, pole)
        toLocal(frame, normal, local)
        quatFromEulerXZY(qLocal, Math.atan2(local.z, local.y) * 0.7 + tiltX, yaw, -Math.atan2(local.x, local.y) * 0.7 + tiltZ)
        multiplyQuat(qLocal, frameRotation(frame, qFrame), qLocal)
        const sy = size * height
        const radius = R + sample.height - sy * ROCK_SINK[cls]
        rocks.push(
          toRock(dir.x * radius, dir.y * radius, dir.z * radius, qLocal, sx, sy, sz, variant, shade * (1 - 0.14 * sample.craterInterior) + 0.08 * sample.ejecta),
        )
      }
      return rocks
    },
  }
}
