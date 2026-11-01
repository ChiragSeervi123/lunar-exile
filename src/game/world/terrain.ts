import type { RegionDef } from '@/types/content'
import { clamp, lerp, smoothstep } from '@/utils/math'
import { createNoise2D, fbm2, ridged2 } from '@/utils/noise'
import { createRng, deriveSeed } from '@/utils/random'
import { createCraterLookup, generateCraters, sampleCrater, type Crater, type CraterAccumulator } from './craters'

export interface TerrainSample extends CraterAccumulator {
  /** 0..1 large-scale albedo: 0 = dark mare basalt, 1 = bright highland regolith. */
  albedo: number
  /** 0..1, how far up the horizon mountains the point lies. */
  mountain: number
}

export interface Terrain {
  /** Half-size of the generated terrain, meters. */
  extent: number
  /** Half-size of the playable area, meters. */
  playableHalfSize: number
  /** Arrival point, on the ground. */
  spawn: { x: number; y: number; z: number }
  craters: readonly Crater[]
  sample(x: number, z: number, out: TerrainSample): TerrainSample
  heightAt(x: number, z: number): number
  /** Unit surface normal at (x, z). */
  normalAt(x: number, z: number): [number, number, number]
}

/** Radius around the spawn point that stays level and free of craters and rocks, meters. */
export const SPAWN_CLEAR_RADIUS = 16
const CRATER_CELL_SIZE = 48

export function createSample(): TerrainSample {
  return { height: 0, craterInterior: 0, craterRim: 0, ejecta: 0, albedo: 0, mountain: 0 }
}

/** Builds the deterministic height function for a region. Cheap; sampling is the costly part. */
export function createTerrain(region: RegionDef): Terrain {
  const def = region.terrain
  const relief = createNoise2D(createRng(deriveSeed(def.seed, 'relief')))
  const detail = createNoise2D(createRng(deriveSeed(def.seed, 'detail')))
  const ridges = createNoise2D(createRng(deriveSeed(def.seed, 'ridges')))
  const albedo = createNoise2D(createRng(deriveSeed(def.seed, 'albedo')))
  const { spawn, terrain: { horizon } } = region

  const craters = generateCraters(
    def,
    { x: spawn.x, z: spawn.z, radius: SPAWN_CLEAR_RADIUS },
    createRng(deriveSeed(def.seed, 'craters')),
  )
  const cratersNear = createCraterLookup(craters, CRATER_CELL_SIZE)

  const baseHeight = (x: number, z: number) =>
    def.relief * fbm2(relief, x / 520, z / 520, 4) +
    def.relief * 0.3 * fbm2(relief, x / 140 + 31.7, z / 140 - 12.3, 3) +
    def.roughness * (0.7 * detail(x / 13, z / 13) + 0.3 * detail(x / 4.5, z / 4.5))
  const spawnHeight = baseHeight(spawn.x, spawn.z)

  const sample = (x: number, z: number, out: TerrainSample): TerrainSample => {
    out.height = baseHeight(x, z)
    out.craterInterior = 0
    out.craterRim = 0
    out.ejecta = 0
    for (const crater of cratersNear(x, z)) sampleCrater(crater, x, z, out)

    // Mountain ring enclosing the basin; the radius is warped so the ring isn't a perfect circle.
    const dist = Math.sqrt(x * x + z * z) + horizon.radius * 0.25 * fbm2(ridges, x / 900, z / 900, 2)
    out.mountain = smoothstep(horizon.radius, horizon.radius * 2, dist)
    if (out.mountain > 0) {
      // Separate massifs with low gaps between them, carved by broad ridges.
      const massif = smoothstep(-0.45, 0.55, fbm2(ridges, x / 1500 + 7.3, z / 1500 - 3.1, 2))
      const ridge = ridged2(ridges, x / 820, z / 820, 3)
      out.height += out.mountain * horizon.height * (0.12 + massif * (0.35 + 0.75 * ridge))
    }

    // Level the landing zone, keeping a trace of surface texture.
    const dx = x - spawn.x
    const dz = z - spawn.z
    const level = 1 - smoothstep(SPAWN_CLEAR_RADIUS * 0.6, SPAWN_CLEAR_RADIUS * 1.6, Math.sqrt(dx * dx + dz * dz))
    if (level > 0) out.height = lerp(out.height, spawnHeight, level * 0.8)

    out.albedo = clamp(0.55 + 0.8 * fbm2(albedo, x / 850, z / 850, 3), 0, 1)
    return out
  }

  const scratch = createSample()
  const heightAt = (x: number, z: number) => sample(x, z, scratch).height

  const normalAt = (x: number, z: number): [number, number, number] => {
    const e = 0.75
    const nx = heightAt(x - e, z) - heightAt(x + e, z)
    const nz = heightAt(x, z - e) - heightAt(x, z + e)
    const ny = 2 * e
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
    return [nx / length, ny / length, nz / length]
  }

  return {
    extent: def.extent,
    playableHalfSize: region.size / 2,
    spawn: { x: spawn.x, y: heightAt(spawn.x, spawn.z), z: spawn.z },
    craters,
    sample,
    heightAt,
    normalAt,
  }
}

export interface Heightfield {
  /** Subdivisions along Z. */
  rows: number
  /** Subdivisions along X. */
  cols: number
  /** (rows + 1) × (cols + 1) heights in column-major order, as Rapier expects. */
  heights: number[]
  sizeX: number
  sizeZ: number
}

/** Uniform height grid over the playable area, for the physics collider. */
export function buildHeightfield(terrain: Terrain, spacing: number): Heightfield {
  const size = terrain.playableHalfSize * 2
  const segments = Math.max(1, Math.round(size / spacing))
  const heights = new Array<number>((segments + 1) * (segments + 1))
  for (let col = 0; col <= segments; col++) {
    const x = -terrain.playableHalfSize + (col / segments) * size
    for (let row = 0; row <= segments; row++) {
      const z = -terrain.playableHalfSize + (row / segments) * size
      heights[col * (segments + 1) + row] = terrain.heightAt(x, z)
    }
  }
  return { rows: segments, cols: segments, heights, sizeX: size, sizeZ: size }
}
