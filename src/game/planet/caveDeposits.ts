import { MINING } from '@/config/mining'
import { getResource } from '@/data/resources'
import type { Deposit } from '@/game/mining'
import { clamp, lerp } from '@/utils/math'
import { createRng, deriveSeed } from '@/utils/random'
import { multiplyQuat, quat, quatFromEulerXZY, vec3, type Vec3 } from '@/utils/vec3'
import { fromCaveLocal, type Cave, type CaveShape } from './caves'
import { createFrame, frameFacing, frameRotation } from './frame'

/** Deposits form only this far down, meters below the entrance. */
const MIN_DEPTH = 4
/** Along each tunnel, a candidate spot every this many meters. */
const STEP = 8

/**
 * How likely each resource is at a given depth (meters below the entrance): common dust and
 * regolith everywhere, the rarer ones more and more the deeper the cave goes. Alien crystals only
 * below 10 m, relics only below 16 m.
 */
export function caveResourceWeights(depth: number): { id: string; weight: number }[] {
  return [
    { id: 'lunar-dust', weight: 3 },
    { id: 'regolith-deposit', weight: 3 },
    { id: 'titanium-vein', weight: 2 * (1 + 0.04 * depth) },
    { id: 'helium3-vein', weight: 1.2 * (1 + 0.08 * depth) },
    { id: 'alien-crystal', weight: depth > 10 ? 0.8 * ((depth - 10) / 10) : 0 },
    { id: 'ancient-relic', weight: depth > 16 ? 0.4 * ((depth - 16) / 8) : 0 },
  ]
}

/**
 * The deposits of a cave, on the floors of its tunnels and chambers: deterministic, with ids
 * stable across sessions (`cave:<cave id>:<resource>:<n>`).
 */
export function createCaveDeposits(seed: number, cave: Cave, shape: CaveShape): Deposit[] {
  const rng = createRng(deriveSeed(seed, `cave-deposits:${cave.id}`))
  const deposits: Deposit[] = []
  const spots: Vec3[] = []
  const counts = new Map<string, number>()
  const frame = createFrame()
  const qFrame = quat()
  const q = quat()
  const world = vec3()
  const pole = vec3(0, 1, 0)

  /** The floor straight below a point in the open: just above where rock begins. */
  const floor = (p: Vec3, reach: number): Vec3 | null => {
    if (shape.open(p) > 0) return null
    for (let d = 0; d < reach; d += 0.15) {
      const below = vec3(p.x, p.y - d, p.z)
      if (shape.open(below) > 0) return vec3(p.x, p.y - d + 0.12, p.z)
    }
    return null
  }

  const candidates: { at: Vec3; reach: number }[] = []
  for (const t of cave.tunnels) {
    const length = Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y, t.b.z - t.a.z)
    for (let s = STEP / 2; s < length; s += STEP) {
      const k = s / length
      // A little to one side of the axis, so deposits aren't all lined up in the middle.
      const side = (rng() - 0.5) * lerp(t.ra, t.rb, k) * 0.8
      candidates.push({
        at: vec3(lerp(t.a.x, t.b.x, k) + side, lerp(t.a.y, t.b.y, k), lerp(t.a.z, t.b.z, k) - side),
        reach: lerp(t.ra, t.rb, k) + 1.5,
      })
    }
  }
  for (const c of cave.chambers) candidates.push({ at: vec3(c.c.x + (rng() - 0.5) * c.r, c.c.y, c.c.z + (rng() - 0.5) * c.r), reach: c.r + 1.5 })

  for (const { at, reach } of candidates) {
    // Fixed draws per candidate, so one never changes another.
    const keep = rng()
    const pick = rng()
    const sizeRoll = rng()
    const yaw = rng() * Math.PI * 2
    const luck = rng()
    const spot = floor(at, reach)
    if (!spot || -spot.y < MIN_DEPTH || keep > 0.75) continue
    if (spots.some((o) => Math.hypot(o.x - spot.x, o.y - spot.y, o.z - spot.z) < MINING.minSpacing + 1.5)) continue
    const weights = caveResourceWeights(-spot.y)
    const total = weights.reduce((n, w) => n + w.weight, 0)
    let roll = pick * total
    const choice = weights.find((w) => (roll -= w.weight) < 0) ?? weights[0]
    const def = getResource(choice.id)
    if (!def) continue
    spots.push(spot)
    fromCaveLocal(cave, spot, world)
    const r = Math.hypot(world.x, world.y, world.z)
    const up = vec3(world.x / r, world.y / r, world.z / r)
    frameFacing(frame, up, pole)
    quatFromEulerXZY(q, 0, yaw, 0)
    multiplyQuat(q, frameRotation(frame, qFrame), q)
    const [minSize, maxSize] = def.appearance.size
    const size = lerp(minSize, maxSize, sizeRoll)
    const k = (size - minSize) / Math.max(1e-6, maxSize - minSize)
    const n = counts.get(choice.id) ?? 0
    counts.set(choice.id, n + 1)
    deposits.push({
      id: `cave:${cave.id}:${choice.id}:${n}`,
      resourceId: choice.id,
      x: world.x,
      y: world.y,
      z: world.z,
      pitch: 0,
      yaw: 0,
      roll: 0,
      orientation: [q.x, q.y, q.z, q.w],
      size,
      maxHealth: Math.round(def.health * lerp(0.8, 1.25, k)),
      yield: Math.round(lerp(def.yield.min, def.yield.max, clamp(k * 0.6 + luck * 0.4, 0, 1))),
    })
  }
  return deposits
}
