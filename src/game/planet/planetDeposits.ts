import { MINING } from '@/config/mining'
import { PROVINCE_TYPES } from '@/data/provinces'
import { RARITIES } from '@/data/rarities'
import { getResource } from '@/data/resources'
import { DEPOSIT_BOUNDS, habitatFit, ROCK_GAP, type Deposit } from '@/game/mining'
import { clamp, DEG2RAD, lerp, smoothstep } from '@/utils/math'
import { createRng, deriveSeed } from '@/utils/random'
import { dot, multiplyQuat, quat, quatFromEulerXZY, vec3, type Vec3 } from '@/utils/vec3'
import { nodeArea } from './cells'
import { faceDirection, gridParam, nodeKey, type CubeNode } from './cubeSphere'
import { chartCoordinates, createFrame, frameFacing, frameRotation, toLocal, type ChartPoint } from './frame'
import { ROCK_CELL_DEPTH, type ClearZone, type PlanetRock, type PlanetRockField } from './rocks'
import { createPlanetSample, type Planet } from './sampler'

/** Deposits are generated per node at this depth (about 86 m across), like rocks. */
export const DEPOSIT_CELL_DEPTH = ROCK_CELL_DEPTH

/**
 * How much likelier a resource of rarity `rank` (0 common .. 4 extremely rare) is at `far`, from
 * 0 at the landing site to 1 deep on the far side. Common resources are the same everywhere; the
 * rarer a resource, the scarcer it is near the landing site and the richer the far side.
 */
export function rarityBoost(rank: number, far: number): number {
  if (rank === 0) return 1
  return lerp(1 - 0.15 * rank, 1 + 0.6 * rank, far)
}

/** 0 at the landing site, rising to 1 a little past the far side's edge (by angle around the Moon). */
export function remoteness(dir: Vec3): number {
  return smoothstep(0.15, Math.PI * 0.75, Math.acos(clamp(dir.y, -1, 1)))
}

export interface PlanetDepositField {
  /**
   * The deposits of one cell (a node at DEPOSIT_CELL_DEPTH): deterministic, with ids stable
   * across sessions (`moon:face:ix:iy:resource:n`). Empty inside the landing site's own field.
   */
  cell(node: CubeNode): readonly Deposit[]
}

const CACHE_SIZE = 2048

/**
 * Deposits over the whole Moon, a cell at a time. Each province lists what forms there and how
 * densely (`data/provinces.ts`); within it each type keeps to its habitat as at the landing site
 * (titanium in dark mare, helium-3 and relics in crater floors, crystals and regolith on rims), and
 * rare types grow likelier the farther from the landing site. Deposits keep clear of rocks, steep
 * ground and each other. The landing site keeps the deposits of Milestone 3.
 */
export function createPlanetDepositField(planet: Planet, rocks: PlanetRockField, clear: readonly ClearZone[] = []): PlanetDepositField {
  const R = planet.radius
  const flat = planet.landing.terrain
  const landingHalf = flat.playableHalfSize
  const nearLanding = Math.cos((landingHalf * Math.SQRT2 + 50) / R)
  const minNormalY = Math.cos(MINING.maxSlope * DEG2RAD)
  const sample = createPlanetSample()
  const dir = vec3()
  const normal = vec3()
  const local = vec3()
  const frame = createFrame()
  const pole = vec3(0, 1, 0)
  const qFrame = quat()
  const q = quat()
  const chart: ChartPoint = { x: 0, z: 0, distance: 0 }

  // Rarest first, so they get the best ground.
  const resources = [...new Set(Object.values(PROVINCE_TYPES).flatMap((t) => t.resources.map((r) => r.resourceId)))]
    .map((id) => ({ id, def: getResource(id)! }))
    .filter((r) => r.def !== undefined)
    .sort((a, b) => RARITIES[b.def.rarity].rank - RARITIES[a.def.rarity].rank || a.id.localeCompare(b.id))
    .map(({ id, def }) => ({ id, def, rank: RARITIES[def.rarity].rank }))

  // Solid rocks deposits must keep clear of: the landing site's, and the Moon's per cell.
  const landingRocks: PlanetRock[] = (() => {
    const set = rocks.landing(0)
    return [...set.medium, ...set.boulder]
  })()
  const solidCache = new Map<number, readonly PlanetRock[]>()
  const solidRocks = (n: CubeNode) => {
    const k = nodeKey(n.face, n.depth, n.ix, n.iy)
    let list = solidCache.get(k)
    if (!list) {
      list = [...rocks.cell(n, 'medium', 0), ...rocks.cell(n, 'boulder', 0)]
      if (solidCache.size >= CACHE_SIZE) solidCache.delete(solidCache.keys().next().value!)
      solidCache.set(k, list)
    }
    return list
  }
  const clearOfRocks = (node: CubeNode, p: Vec3, radius: number) => {
    const cells = 2 ** node.depth
    const lists: (readonly PlanetRock[])[] = []
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const ix = node.ix + dx
        const iy = node.iy + dy
        // Across a cube edge the neighbours are on another face; a deposit sits at least a few
        // meters inside its own cell, so missing those rare overlaps is harmless.
        if (ix < 0 || iy < 0 || ix >= cells || iy >= cells) continue
        lists.push(solidRocks({ face: node.face, depth: node.depth, ix, iy }))
      }
    }
    if (dir.y > nearLanding) lists.push(landingRocks)
    for (const list of lists) {
      for (const r of list) {
        // Rock shapes are unit icosahedra stretched up to 1.3x, so this bounds their reach.
        const reach = Math.max(r.sx, r.sz) * 1.3 + radius + ROCK_GAP
        const dx = r.x - p.x
        const dy = r.y - p.y
        const dz = r.z - p.z
        if (dx * dx + dy * dy + dz * dz < reach * reach) return false
      }
    }
    return true
  }

  const generate = (node: CubeNode): Deposit[] => {
    const list: Deposit[] = []
    const { face, ix, iy } = node
    const cells = 2 ** node.depth
    const s0 = gridParam(ix, cells)
    const t0 = gridParam(iy, cells)
    const span = 2 / cells
    const hectares = nodeArea(node, R) / 10_000
    const cellMeters = Math.sqrt(hectares * 10_000)
    const placed: { p: Vec3; r: number }[] = []
    const rng = createRng(deriveSeed(planet.seed, `deposits:${face}:${node.depth}:${ix}:${iy}`))
    // The province in the middle of the cell sets how many of each type to place, as a region does
    // on the flat map; each type then looks for its habitat within the cell.
    faceDirection(face, s0 + span / 2, t0 + span / 2, dir)
    const home = planet.provinceAt(dir)
    const homeRemoteness = remoteness(dir)
    for (const { id, def, rank } of resources) {
      const bounds = DEPOSIT_BOUNDS[def.appearance.shape]
      const [minSize, maxSize] = def.appearance.size
      const density = home.def.resources.find((r) => r.resourceId === id)?.density ?? 0
      const expected = hectares * density * rarityBoost(rank, homeRemoteness)
      // Drawn even when nothing is wanted, so each type's numbers never depend on another's.
      const roll = rng()
      const wanted = Math.floor(expected) + (roll < expected % 1 ? 1 : 0)
      if (wanted === 0) continue
      // Each cell keeps its deposits a little inside its edges, so neighbouring cells never crowd.
      const margin = (MINING.minSpacing / 2 + bounds.radius * maxSize) / cellMeters
      let n = 0
      for (let attempt = 0; n < wanted && attempt < wanted * 60; attempt++) {
        // Every candidate draws the same numbers whether it is kept or not.
        const s = s0 + span * (margin + (1 - 2 * margin) * rng())
        const t = t0 + span * (margin + (1 - 2 * margin) * rng())
        const keep = rng()
        const size = lerp(minSize, maxSize, rng())
        const yaw = rng() * Math.PI * 2
        const luck = rng()

        faceDirection(face, s, t, dir)
        if (clear.some((z) => dot(z.dir, dir) > Math.cos(z.radius / R))) continue
        if (dir.y > nearLanding) {
          chartCoordinates(dir, R, chart)
          if (Math.abs(chart.x) <= landingHalf && Math.abs(chart.z) <= landingHalf) continue
        }
        // Near a province border, only where this type forms.
        if (!planet.provinceAt(dir).def.resources.some((r) => r.resourceId === id)) continue
        planet.sample(dir, sample)
        // A small floor keeps every spot possible outside the type's habitat, just much less likely.
        if (keep > 0.03 + 0.97 * habitatFit(def.habitat, sample)) continue
        planet.normalAt(dir, normal)
        if (dot(normal, dir) < minNormalY) continue
        const r = R + sample.height
        const p = vec3(dir.x * r, dir.y * r, dir.z * r)
        const radius = bounds.radius * size
        if (placed.some((o) => Math.hypot(o.p.x - p.x, o.p.y - p.y, o.p.z - p.z) < o.r + radius + MINING.minSpacing)) continue
        if (!clearOfRocks(node, p, radius)) continue

        placed.push({ p, r: radius })
        // Lean with the slope (in the ground's own frame, as on the flat map), then a spin.
        frameFacing(frame, dir, pole)
        toLocal(frame, normal, local)
        quatFromEulerXZY(q, Math.atan2(local.z, local.y) * 0.6, yaw, -Math.atan2(local.x, local.y) * 0.6)
        multiplyQuat(q, frameRotation(frame, qFrame), q)
        const k = (size - minSize) / Math.max(1e-6, maxSize - minSize)
        list.push({
          id: `moon:${face}:${ix}:${iy}:${id}:${n++}`,
          resourceId: id,
          x: p.x,
          y: p.y,
          z: p.z,
          pitch: 0,
          yaw: 0,
          roll: 0,
          orientation: [q.x, q.y, q.z, q.w],
          size,
          maxHealth: Math.round(def.health * lerp(0.8, 1.25, k)),
          // Bigger deposits tend to give more, with some luck either way.
          yield: Math.round(lerp(def.yield.min, def.yield.max, clamp(k * 0.6 + luck * 0.4, 0, 1))),
        })
      }
    }
    return list
  }

  const cache = new Map<number, readonly Deposit[]>()
  return {
    cell(node) {
      const k = nodeKey(node.face, node.depth, node.ix, node.iy)
      let list = cache.get(k)
      if (list) {
        cache.delete(k)
        cache.set(k, list)
        return list
      }
      list = generate(node)
      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!)
      cache.set(k, list)
      return list
    },
  }
}
