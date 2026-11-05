import { clamp, DEG2RAD } from '@/utils/math'
import { createRng, deriveSeed, randRange } from '@/utils/random'
import { cross, dot, normalize, vec3, type Vec3 } from '@/utils/vec3'
import type { Planet } from './sampler'

/** Things to find on the Moon besides its provinces. */
export type SiteKind = 'crater' | 'structure' | 'cave'
/** Shapes of the alien structures. */
export type StructureKind = 'monolith' | 'arch' | 'pillars'

export interface DiscoverySite {
  id: string
  kind: SiteKind
  name: string
  /** One line about it, for the discovery notice. */
  description: string
  /** Unit direction of its centre (a cave's entrance, a structure's base). */
  dir: Vec3
  /** Found once the astronaut comes within this distance of the centre, along the ground, meters. */
  radius: number
  /** Rocks and deposits keep this far away, meters (0: nothing to keep clear). */
  clearance: number
  structure?: StructureKind
  /** Turn about the local vertical, radians (structures). */
  yaw?: number
}

const CRATER_NAMES = ['Lyot', 'Schrödinger', 'Apollo', 'Hertz', 'Moscoviense', 'Tsiolkovskiy', 'Planck', 'Poincaré', 'Chebyshev', 'Mendel']
const STRUCTURES: Record<StructureKind, { names: string[]; description: string }> = {
  monolith: { names: ['Monolith', 'Black Slab', 'Standing Stone'], description: 'A perfect slab of dark stone. Nothing on the Moon cuts rock like this.' },
  arch: { names: ['The Arch', 'Gate', 'Span'], description: 'An arch of fused regolith, older than the craters around it.' },
  pillars: { names: ['Pillar Ring', 'Circle of Spires', 'Henge'], description: 'Pillars in a ring, faintly glowing, aligned to nothing in the sky.' },
}
const KINDS: StructureKind[] = ['monolith', 'arch', 'pillars']

/**
 * Every place worth finding, besides the provinces: the landmark craters (the giant far-side basin
 * among them), alien structures (two in each anomaly, and a few lone monoliths elsewhere on the far
 * side) and cave entrances. Deterministic for the Moon's seed.
 */
export function createDiscoverySites(planet: Planet): DiscoverySite[] {
  const R = planet.radius
  const sites: DiscoverySite[] = []
  planet.landmarks.forEach((l, i) => {
    const basin = i === 0 && l.radius > 900
    sites.push({
      id: `crater-${i}`,
      kind: 'crater',
      name: basin ? 'The Great Basin' : `${CRATER_NAMES[(i - 1 + CRATER_NAMES.length) % CRATER_NAMES.length]} Crater`,
      description: basin ? 'The scar of the largest impact the Moon ever took.' : `A crater ${(l.radius * 2) / 1000 >= 1 ? `${((l.radius * 2) / 1000).toFixed(1)} km` : `${Math.round(l.radius * 2)} m`} across.`,
      dir: l.dir,
      // Found on reaching its rim.
      radius: l.radius,
      clearance: 0,
    })
  })

  const rng = createRng(deriveSeed(planet.seed, 'structures'))
  const normal = vec3()
  const place = (around: Vec3, near: number, far: number): Vec3 | null => {
    const helper = Math.abs(around.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)
    const e1 = normalize(vec3(), cross(vec3(), helper, around))
    const e2 = cross(vec3(), around, e1)
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = rng() * Math.PI * 2
      const a = randRange(rng, near, far) / R
      const k = Math.sin(a)
      const dir = normalize(vec3(), vec3(
        around.x * Math.cos(a) + (e1.x * Math.cos(angle) + e2.x * Math.sin(angle)) * k,
        around.y * Math.cos(a) + (e1.y * Math.cos(angle) + e2.y * Math.sin(angle)) * k,
        around.z * Math.cos(a) + (e1.z * Math.cos(angle) + e2.z * Math.sin(angle)) * k,
      ))
      if (Math.acos(clamp(dot(planet.normalAt(dir, normal), dir), -1, 1)) > 12 * DEG2RAD) continue
      if (planet.caves.some((c) => Math.acos(clamp(dot(c.dir, dir), -1, 1)) * R < 60)) continue
      if (sites.some((s) => s.kind === 'structure' && Math.acos(clamp(dot(s.dir, dir), -1, 1)) * R < 80)) continue
      return dir
    }
    return null
  }
  const structure = (dir: Vec3 | null, kind: StructureKind) => {
    if (!dir) return
    const n = sites.filter((s) => s.kind === 'structure').length
    const { names, description } = STRUCTURES[kind]
    const greek = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'][n % 10]
    sites.push({
      id: `structure-${n}`,
      kind: 'structure',
      name: `${names[n % names.length]} ${greek}`,
      description,
      dir,
      radius: 30,
      clearance: 12,
      structure: kind,
      yaw: rng() * Math.PI * 2,
    })
  }
  const anomalies = planet.provinces.filter((p) => p.kind === 'anomaly')
  anomalies.forEach((p, i) => {
    structure(place(p.center, 60, 240), KINDS[(i * 2) % 3])
    structure(place(p.center, 60, 240), KINDS[(i * 2 + 1) % 3])
  })
  const farOthers = planet.provinces.filter((p) => p.side === 'far' && p.kind !== 'anomaly' && p.kind !== 'impact-basin')
  for (let i = 0; i < 4 && farOthers.length > 0; i++) {
    structure(place(farOthers[Math.floor(rng() * farOthers.length)].center, 100, 500), 'monolith')
  }

  for (const cave of planet.caves) {
    sites.push({
      id: cave.id,
      kind: 'cave',
      name: cave.name,
      description: `A way down into the Moon, ${Math.round(cave.depth)} m deep.`,
      dir: cave.dir,
      radius: 12,
      clearance: 14,
    })
  }
  return sites
}
