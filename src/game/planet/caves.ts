import { clamp, DEG2RAD, lerp } from '@/utils/math'
import { createSmoothNoise3D } from '@/utils/noise'
import { createRng, deriveSeed, randRange, type Rng } from '@/utils/random'
import { cross, dot, normalize, vec3, type Vec3 } from '@/utils/vec3'
import { createFrame, frameFacing, type Frame } from './frame'
import type { Province } from './provinces'

/*
 * Caves: tunnel networks under the surface, one per province. A cave is described as a set of
 * capsules (tunnels) and spheres (chambers) in the local frame of its entrance (x east, y up,
 * z south, meters from the entrance point); rock is everywhere outside them, below the ground.
 * The surface keeps its height function; only each cave's own volume is meshed (scene/caves).
 */

export interface CaveTunnel {
  a: Vec3
  b: Vec3
  /** Radius at each end. */
  ra: number
  rb: number
}

export interface CaveChamber {
  c: Vec3
  r: number
}

export interface Cave {
  id: string
  name: string
  /** Province the entrance is in. */
  province: string
  /** Unit direction of the entrance, and the entrance point on the ground (world). */
  dir: Vec3
  origin: Vec3
  /** Local axes at the entrance. */
  frame: Frame
  tunnels: CaveTunnel[]
  chambers: CaveChamber[]
  /** Local box around the whole cave, with room for its walls. */
  min: Vec3
  max: Vec3
  /** Deepest point of the cave below its entrance, meters. */
  depth: number
}

/** The cave's rock: positive in rock, negative in open space (before the ground and digging). */
export interface CaveShape {
  /** Signed distance to the open space at local point p, meters (roughened a little). */
  open(p: Vec3): number
  /**
   * The same shape, using only the tunnels and chambers that can reach the local box [min, max]
   * (exact inside it, and much faster); null if none can, so the box is solid rock.
   */
  within(min: Vec3, max: Vec3): CaveShape | null
}

const NAMES = [
  'Cave', 'Grotto', 'Hollow', 'Tube', 'Undercroft', 'Vault', 'Gallery', 'Warren',
]
const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu']

/** Ground slope (degrees) above which no cave entrance is placed. */
const MAX_ENTRANCE_SLOPE = 14
/** Keeps caves this far from the landing point, meters (the flat map stays as it was). */
const LANDING_CLEARANCE = 620

interface Ground {
  radius: number
  surfaceRadius(dir: Vec3): number
  normalAt(dir: Vec3, out: Vec3): Vec3
}

/** Where to look for a spot: around each province's centre, on gentle ground. */
export function createCaves(seed: number, ground: Ground, provinces: readonly Province[]): Cave[] {
  const R = ground.radius
  const caves: Cave[] = []
  const normal = vec3()
  provinces.forEach((province, i) => {
    const rng = createRng(deriveSeed(seed, `cave:${i}`))
    const c = province.center
    const helper = Math.abs(c.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)
    const e1 = normalize(vec3(), cross(vec3(), helper, c))
    const e2 = cross(vec3(), c, e1)
    for (let attempt = 0; attempt < 60; attempt++) {
      const angle = rng() * Math.PI * 2
      const dist = randRange(rng, 90, province.kind === 'landing-basin' ? 900 : 320)
      const a = dist / R
      const k = Math.sin(a)
      const dir = normalize(vec3(), vec3(
        c.x * Math.cos(a) + (e1.x * Math.cos(angle) + e2.x * Math.sin(angle)) * k,
        c.y * Math.cos(a) + (e1.y * Math.cos(angle) + e2.y * Math.sin(angle)) * k,
        c.z * Math.cos(a) + (e1.z * Math.cos(angle) + e2.z * Math.sin(angle)) * k,
      ))
      if (Math.acos(clamp(dir.y, -1, 1)) * R < LANDING_CLEARANCE) continue
      if (Math.acos(clamp(dot(ground.normalAt(dir, normal), dir), -1, 1)) > MAX_ENTRANCE_SLOPE * DEG2RAD) continue
      if (caves.some((o) => Math.acos(clamp(dot(o.dir, dir), -1, 1)) * R < 400)) continue
      const r = ground.surfaceRadius(dir)
      const frame = frameFacing(createFrame(), dir, vec3(0, 1, 0))
      const n = caves.length
      caves.push({
        id: `cave-${n}`,
        name: `${GREEK[n % GREEK.length]} ${NAMES[Math.floor(n / GREEK.length) % NAMES.length]}`,
        province: province.id,
        dir,
        origin: vec3(dir.x * r, dir.y * r, dir.z * r),
        frame,
        ...layout(rng),
      })
      break
    }
  })
  return caves
}

/**
 * A cave's tunnels: a walkable ramp down from the entrance, then a few branching tunnels that
 * wander and mostly descend, with chambers along them.
 */
function layout(rng: Rng): Pick<Cave, 'tunnels' | 'chambers' | 'min' | 'max' | 'depth'> {
  const tunnels: CaveTunnel[] = []
  const chambers: CaveChamber[] = []
  const heading = rng() * Math.PI * 2
  // The ramp: 28° down, long enough to get well under the surface.
  const ramp = 20
  const drop = Math.tan(28 * DEG2RAD)
  const start = vec3(0, 1.2, 0)
  const end = vec3(Math.sin(heading) * ramp, 1.2 - ramp * drop, -Math.cos(heading) * ramp)
  tunnels.push({ a: start, b: end, ra: 2.9, rb: 3.2 })
  chambers.push({ c: vec3(end.x, end.y + 1.5, end.z), r: randRange(rng, 5, 6.5) })

  const branches = 3 + Math.floor(rng() * 3)
  for (let b = 0; b < branches; b++) {
    let p = vec3(end.x, end.y, end.z)
    let dirAngle = heading + (b / branches) * Math.PI * 2 + randRange(rng, -0.4, 0.4)
    let radius = randRange(rng, 2.5, 3.3)
    const segments = 3 + Math.floor(rng() * 4)
    for (let s = 0; s < segments; s++) {
      dirAngle += randRange(rng, -0.7, 0.7)
      const length = randRange(rng, 8, 14)
      // Mostly downward, never steeper than a person can walk.
      const slope = randRange(rng, -24, 6) * DEG2RAD
      let next = vec3(
        p.x + Math.sin(dirAngle) * length * Math.cos(slope),
        p.y + Math.sin(slope) * length,
        p.z - Math.cos(dirAngle) * length * Math.cos(slope),
      )
      // Stay within the cave's reach: no deeper than 36 m, no farther than 55 m out.
      if (next.y < -36) next.y = -36
      const out = Math.hypot(next.x, next.z)
      if (out > 55) next = vec3((next.x / out) * 55, next.y, (next.z / out) * 55)
      // Clamping can shorten the run: keep every tunnel walkable (28° at most), and skip stubs.
      const run = Math.hypot(next.x - p.x, next.z - p.z)
      if (run < 3) continue
      const rise = run * Math.tan(28 * DEG2RAD)
      next.y = clamp(next.y, p.y - rise, p.y + rise)
      const nextRadius = clamp(radius + randRange(rng, -0.4, 0.5), 2.4, 3.8)
      tunnels.push({ a: p, b: next, ra: radius, rb: nextRadius })
      if (rng() < 0.35) chambers.push({ c: vec3(next.x, next.y + 1.2, next.z), r: randRange(rng, 4.5, 7.5) })
      p = next
      radius = nextRadius
    }
  }

  const min = vec3(Infinity, Infinity, Infinity)
  const max = vec3(-Infinity, -Infinity, -Infinity)
  const grow = (p: Vec3, r: number) => {
    min.x = Math.min(min.x, p.x - r - 3)
    min.y = Math.min(min.y, p.y - r - 3)
    min.z = Math.min(min.z, p.z - r - 3)
    max.x = Math.max(max.x, p.x + r + 3)
    max.y = Math.max(max.y, p.y + r + 3)
    max.z = Math.max(max.z, p.z + r + 3)
  }
  for (const t of tunnels) {
    grow(t.a, t.ra)
    grow(t.b, t.rb)
  }
  for (const c of chambers) grow(c.c, c.r)
  max.y = Math.max(max.y, 4)
  return { tunnels, chambers, min, max, depth: -Math.min(...tunnels.map((t) => Math.min(t.a.y, t.b.y))) }
}

/** Distance from p to segment ab, and where along it (0..1). */
function segment(p: Vec3, a: Vec3, b: Vec3): { d: number; t: number } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / (abx * abx + aby * aby + abz * abz), 0, 1)
  return { d: Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t), t }
}

/** The shape of a cave's open space, with walls roughened by noise (deterministic per cave). */
export function caveShape(seed: number, cave: Cave): CaveShape {
  const noise = createSmoothNoise3D(createRng(deriveSeed(seed, `cave-walls:${cave.id}`)))
  /** How much the noise can move a wall, meters. */
  const ROUGH = 0.45
  const make = (tunnels: readonly CaveTunnel[], chambers: readonly CaveChamber[]): CaveShape => ({
    open(p) {
      let d = Infinity
      for (const t of tunnels) {
        const s = segment(p, t.a, t.b)
        d = Math.min(d, s.d - lerp(t.ra, t.rb, s.t))
      }
      for (const c of chambers) d = Math.min(d, Math.hypot(p.x - c.c.x, p.y - c.c.y, p.z - c.c.z) - c.r)
      // Rough, uneven walls rather than smooth tubes. Far from every tunnel the rock is just solid.
      return d > 8 ? d : d + ROUGH * noise(p.x / 3.2, p.y / 3.2, p.z / 3.2)
    },
    within(min, max) {
      // Distance from a point to the box, for each primitive's nearest reach.
      const boxDistance = (p: Vec3) =>
        Math.hypot(Math.max(min.x - p.x, 0, p.x - max.x), Math.max(min.y - p.y, 0, p.y - max.y), Math.max(min.z - p.z, 0, p.z - max.z))
      const reachesBox = (a: Vec3, b: Vec3, r: number) => {
        // Sample along the segment: tunnels are short compared with how far we look.
        for (let i = 0; i <= 8; i++) {
          const t = i / 8
          if (boxDistance(vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)) < r + ROUGH + 2.5) return true
        }
        return false
      }
      const t = tunnels.filter((x) => reachesBox(x.a, x.b, Math.max(x.ra, x.rb)))
      const c = chambers.filter((x) => boxDistance(x.c) < x.r + ROUGH + 2.5)
      return t.length + c.length > 0 ? make(t, c) : null
    },
  })
  return make(cave.tunnels, cave.chambers)
}

/** Local coordinates (x east, y up, z south) of world point `p` in a cave's frame. */
export function toCaveLocal(cave: Cave, p: Vec3, out: Vec3): Vec3 {
  const dx = p.x - cave.origin.x
  const dy = p.y - cave.origin.y
  const dz = p.z - cave.origin.z
  const { east, up, north } = cave.frame
  out.x = dx * east.x + dy * east.y + dz * east.z
  out.y = dx * up.x + dy * up.y + dz * up.z
  out.z = -(dx * north.x + dy * north.y + dz * north.z)
  return out
}

/** World point of local coordinates in a cave's frame. */
export function fromCaveLocal(cave: Cave, l: Vec3, out: Vec3): Vec3 {
  const { east, up, north } = cave.frame
  out.x = cave.origin.x + east.x * l.x + up.x * l.y - north.x * l.z
  out.y = cave.origin.y + east.y * l.x + up.y * l.y - north.y * l.z
  out.z = cave.origin.z + east.z * l.x + up.z * l.y - north.z * l.z
  return out
}
