import { PROVINCE_TYPES } from '@/data/provinces'
import type { ProvinceKind, ProvinceTypeDef } from '@/types/content'
import { smoothstep } from '@/utils/math'
import { createSmoothNoise3D, fbm3, type Noise3D } from '@/utils/noise'
import { createRng, deriveSeed, randRange, type Rng } from '@/utils/random'
import { dot, normalize, setVec, vec3, type Vec3 } from '@/utils/vec3'
import { chartDirection } from './frame'

export interface Province {
  index: number
  /** Stable across sessions; the landing basin keeps its region id. */
  id: string
  kind: ProvinceKind
  def: ProvinceTypeDef
  name: string
  /** Unit direction of the province's centre. */
  center: Vec3
  /** Facing Earth, or on the far side. */
  side: 'near' | 'far'
}

/** Province parameters at a point, blended from the nearest provinces. */
export interface ProvinceBlend {
  /** Index of the province the point belongs to. */
  dominant: number
  relief: number
  roughness: number
  craters: number
  ridges: number
  rilles: number
  terraces: number
  albedo: number
  rocks: number
  /** Surface tint colour (linear RGB) and its strength. */
  tintR: number
  tintG: number
  tintB: number
  tintAmount: number
}

export function createBlend(): ProvinceBlend {
  return {
    dominant: 0,
    relief: 0,
    roughness: 0,
    craters: 0,
    ridges: 0,
    rilles: 0,
    terraces: 0,
    albedo: 0,
    rocks: 0,
    tintR: 0,
    tintG: 0,
    tintB: 0,
    tintAmount: 0,
  }
}

export interface ProvinceField {
  provinces: readonly Province[]
  /** Parameters at a unit direction, blended across nearby borders. */
  blend(dir: Vec3, out: ProvinceBlend): ProvinceBlend
  /** The province a unit direction belongs to. */
  at(dir: Vec3): Province
}

/**
 * A province contributes to the blend while it is less than this much farther away than the
 * nearest one, radians: a border zone about 350 m wide on the Moon. Weights reach exactly zero at
 * the cutoff, so nothing jumps when the set of nearby provinces changes.
 */
const BLEND_CUTOFF = 0.1
/** How far borders are pushed around by noise, radians, so they wander instead of running straight. */
const WARP = 0.12
const WARP_FREQUENCY = 2.2
/** How many nearby provinces are considered: more than can ever lie within the cutoff of each other. */
const NEIGHBOURS = 4

/** Kinds placed on each side when nothing more specific is required, with relative weights. */
const NEAR_MIX: [ProvinceKind, number][] = [
  ['mare', 3],
  ['highlands', 2],
  ['crater-field', 1.5],
  ['mountains', 1.2],
  ['rilles', 1.2],
  ['regolith-plain', 1.2],
  ['mineral', 0.6],
]
const FAR_MIX: [ProvinceKind, number][] = [
  ['farside-highlands', 4],
  ['crater-field', 2],
  ['mountains', 1.5],
  ['regolith-plain', 1],
  ['mineral', 0.6],
]

function pick(rng: Rng, mix: [ProvinceKind, number][]): ProvinceKind {
  const total = mix.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [kind, w] of mix) {
    r -= w
    if (r <= 0) return kind
  }
  return mix[mix.length - 1][0]
}

/** Evenly spread points on the unit sphere (a Fibonacci lattice), each nudged at random. */
function scatterCentres(count: number, rng: Rng): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const spacing = Math.sqrt((4 * Math.PI) / count)
  const points: Vec3[] = []
  for (let i = 0; i < count; i++) {
    const y = 1 - ((i + 0.5) * 2) / count
    const r = Math.sqrt(1 - y * y)
    const phi = i * golden
    const p = vec3(Math.cos(phi) * r, y, Math.sin(phi) * r)
    // Nudge sideways by up to a quarter of the spacing.
    const nudge = vec3(randRange(rng, -1, 1), randRange(rng, -1, 1), randRange(rng, -1, 1))
    const along = dot(nudge, p)
    setVec(nudge, nudge.x - p.x * along, nudge.y - p.y * along, nudge.z - p.z * along)
    normalize(nudge, nudge)
    const amount = rng() * spacing * 0.25
    points.push(normalize(p, setVec(p, p.x + nudge.x * amount, p.y + nudge.y * amount, p.z + nudge.z * amount)))
  }
  return points
}

const nearest = (points: Vec3[], target: Vec3, taken: Set<number>) => {
  let best = -1
  let bestDot = -2
  points.forEach((p, i) => {
    const d = dot(p, target)
    if (!taken.has(i) && d > bestDot) {
      bestDot = d
      best = i
    }
  })
  return best
}

/**
 * Divides the Moon into provinces. The landing basin is centred exactly on the landing site; a
 * mountain range rises to its north, under Earth; the province opposite Earth holds the giant
 * impact basin, and alien anomalies lie on the far side. The rest follow each side's mix, so the
 * Earth-facing side is dark maria and rilles while the far side is bright, cratered upland.
 */
export function createProvinceField(seed: number, count: number, radius: number, earth: Vec3): ProvinceField {
  const rng = createRng(deriveSeed(seed, 'provinces'))
  const centres = scatterCentres(count, rng)
  const kinds: (ProvinceKind | null)[] = centres.map(() => null)
  const taken = new Set<number>()
  const assign = (index: number, kind: ProvinceKind) => {
    kinds[index] = kind
    taken.add(index)
  }

  const landing = nearest(centres, vec3(0, 1, 0), taken)
  setVec(centres[landing], 0, 1, 0)
  assign(landing, 'landing-basin')
  // Mountains on the northern horizon, where Earth hangs low in the sky.
  assign(nearest(centres, chartDirection(0, -1500, radius, vec3()), taken), 'mountains')
  const farPole = vec3(-earth.x, -earth.y, -earth.z)
  assign(nearest(centres, farPole, taken), 'impact-basin')

  const sideOf = (p: Vec3): 'near' | 'far' => (dot(p, earth) >= 0 ? 'near' : 'far')
  const open = (side: 'near' | 'far') => centres.map((_, i) => i).filter((i) => !taken.has(i) && sideOf(centres[i]) === side)
  const takeRandom = (side: 'near' | 'far', kind: ProvinceKind) => {
    const choices = open(side)
    if (choices.length > 0) assign(choices[Math.floor(rng() * choices.length)], kind)
  }
  // Every guaranteed discovery exists at least once.
  takeRandom('far', 'anomaly')
  takeRandom('far', 'anomaly')
  takeRandom('far', 'mineral')
  takeRandom('near', 'mineral')
  takeRandom('near', 'rilles')
  takeRandom('near', 'mare')
  takeRandom('near', 'mare')
  centres.forEach((p, i) => {
    if (kinds[i] === null) assign(i, pick(rng, sideOf(p) === 'near' ? NEAR_MIX : FAR_MIX))
  })

  const used: Partial<Record<ProvinceKind, number>> = {}
  const provinces: Province[] = centres.map((center, index) => {
    const kind = kinds[index]!
    const def = PROVINCE_TYPES[kind]
    const n = used[kind] ?? 0
    used[kind] = n + 1
    const base = def.names[n % def.names.length]
    const name = n < def.names.length ? base : `${base} ${Math.floor(n / def.names.length) + 1}`
    return {
      index,
      id: kind === 'landing-basin' ? 'landing-site' : `province-${index}`,
      kind,
      def,
      name,
      center,
      side: sideOf(center),
    }
  })

  const warpNoise: Noise3D = createSmoothNoise3D(createRng(deriveSeed(seed, 'province-borders')))
  const warped = vec3()
  const best = new Int32Array(NEIGHBOURS)
  const bestDot = new Float64Array(NEIGHBOURS)

  /** Fills `best` with the nearest provinces to a (warped) direction, nearest first. */
  const findNearest = (dir: Vec3) => {
    const f = WARP_FREQUENCY
    setVec(
      warped,
      dir.x + WARP * fbm3(warpNoise, dir.x * f, dir.y * f, dir.z * f, 2),
      dir.y + WARP * fbm3(warpNoise, dir.x * f + 41.3, dir.y * f - 7.1, dir.z * f + 13.9, 2),
      dir.z + WARP * fbm3(warpNoise, dir.x * f - 23.7, dir.y * f + 31.1, dir.z * f - 5.3, 2),
    )
    normalize(warped, warped)
    best.fill(-1)
    bestDot.fill(-2)
    for (let i = 0; i < provinces.length; i++) {
      const c = provinces[i].center
      const d = warped.x * c.x + warped.y * c.y + warped.z * c.z
      if (d <= bestDot[NEIGHBOURS - 1]) continue
      let k = NEIGHBOURS - 1
      while (k > 0 && d > bestDot[k - 1]) {
        bestDot[k] = bestDot[k - 1]
        best[k] = best[k - 1]
        k--
      }
      bestDot[k] = d
      best[k] = i
    }
  }

  return {
    provinces,
    at(dir) {
      findNearest(dir)
      return provinces[best[0]]
    },
    blend(dir, out) {
      findNearest(dir)
      const a0 = Math.acos(Math.min(1, bestDot[0]))
      let total = 0
      out.dominant = best[0]
      out.relief = out.roughness = out.craters = out.ridges = out.rilles = out.terraces = 0
      out.albedo = out.rocks = out.tintR = out.tintG = out.tintB = out.tintAmount = 0
      for (let k = 0; k < NEIGHBOURS; k++) {
        if (best[k] < 0) continue
        const w = 1 - smoothstep(0, BLEND_CUTOFF, Math.acos(Math.min(1, bestDot[k])) - a0)
        if (w <= 0) continue
        const def = provinces[best[k]].def
        total += w
        out.relief += def.relief * w
        out.roughness += def.roughness * w
        out.craters += def.craters * w
        out.ridges += def.ridges * w
        out.rilles += def.rilles * w
        out.terraces += def.terraces * w
        out.albedo += def.albedo * w
        out.rocks += def.rocks * w
        if (def.tint) {
          const s = def.tint.strength * w
          out.tintR += def.tint.color[0] * s
          out.tintG += def.tint.color[1] * s
          out.tintB += def.tint.color[2] * s
          out.tintAmount += s
        }
      }
      const k = 1 / total
      out.relief *= k
      out.roughness *= k
      out.craters *= k
      out.ridges *= k
      out.rilles *= k
      out.terraces *= k
      out.albedo *= k
      out.rocks *= k
      if (out.tintAmount > 0) {
        out.tintR /= out.tintAmount
        out.tintG /= out.tintAmount
        out.tintB /= out.tintAmount
        out.tintAmount *= k
      }
      return out
    },
  }
}
