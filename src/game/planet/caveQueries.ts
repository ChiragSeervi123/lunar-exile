import { clamp } from '@/utils/math'
import { dot, vec3, type Vec3 } from '@/utils/vec3'
import { caveShape, toCaveLocal, type Cave, type CaveShape } from './caves'
import type { Planet } from './sampler'

/** Local height (meters, up from the entrance) of the rock "lid" just under the ground, in a cave's frame. */
export const CAVE_LID = 0.3

export interface CaveQueries {
  /** The cave's shape (its open space), created once per cave. */
  shape(cave: Cave): CaveShape
  /** Caves whose volume may contain world point `p`. */
  near(p: Vec3, margin?: number): Cave[]
  /**
   * Whether ground at world point `p` opens into a cave (the terrain has a hole there): the point
   * lies in a cave's open space, close to the surface.
   */
  opensAt(p: Vec3): boolean
  /**
   * The cave world point `p` is inside of, underground (at least `below` meters under the
   * surface, within the cave's volume), or null. Nothing pushes such a point back up to the ground.
   */
  underground(p: Vec3, below?: number): Cave | null
}

/** Questions about the caves that terrain, physics, the camera and lighting all need answered. */
export function createCaveQueries(planet: Planet): CaveQueries {
  const shapes = new Map<string, CaveShape>()
  const local = vec3()
  const dir = vec3()
  const R = planet.radius
  // How far a cave's volume reaches from its entrance, along the ground.
  const reach = new Map(planet.caves.map((c) => [c.id, Math.hypot(Math.max(-c.min.x, c.max.x), Math.max(-c.min.z, c.max.z)) + 4]))
  const shape = (cave: Cave) => {
    let s = shapes.get(cave.id)
    if (!s) shapes.set(cave.id, (s = caveShape(planet.seed, cave)))
    return s
  }
  const near = (p: Vec3, margin = 0) => {
    const r = Math.hypot(p.x, p.y, p.z)
    dir.x = p.x / r
    dir.y = p.y / r
    dir.z = p.z / r
    return planet.caves.filter((c) => Math.acos(clamp(dot(c.dir, dir), -1, 1)) * R < reach.get(c.id)! + margin)
  }
  const inBox = (c: Cave, l: Vec3) => l.x > c.min.x && l.x < c.max.x && l.y > c.min.y && l.y < c.max.y + 2 && l.z > c.min.z && l.z < c.max.z
  return {
    shape,
    near,
    opensAt(p) {
      for (const c of near(p)) {
        toCaveLocal(c, p, local)
        if (inBox(c, local) && shape(c).open(local) < 0.15) return true
      }
      return false
    },
    underground(p, below = 0.5) {
      for (const c of near(p)) {
        toCaveLocal(c, p, local)
        if (!inBox(c, local)) continue
        const r = Math.hypot(p.x, p.y, p.z)
        dir.x = p.x / r
        dir.y = p.y / r
        dir.z = p.z / r
        if (r < planet.surfaceRadius(dir) - below) return c
      }
      return null
    },
  }
}
