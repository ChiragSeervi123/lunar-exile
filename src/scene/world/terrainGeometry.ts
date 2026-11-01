import { BufferAttribute, BufferGeometry, Color } from 'three'
import { createSample, type Terrain } from '@/game/world'
import type { SurfacePaletteDef } from '@/types/content'
import { smoothstep } from '@/utils/math'
import { createRng } from '@/utils/random'

export interface TerrainMeshOptions {
  /** Vertex spacing inside the playable area, meters. */
  spacing: number
  /** Segments per side of each square ring of the horizon mesh. */
  horizonSegments: number
  seed: number
}

export interface TerrainMeshes {
  /** Playable area: a jittered grid that casts and receives shadows. */
  near: BufferGeometry
  /** Concentric rings out to the horizon, coarser with distance; shares its inner edge with `near`. */
  far: BufferGeometry
}

/**
 * Max vertex offset, as a fraction of the local spacing, to break up the visible grid. Must stay
 * below 0.25 so no grid cell can fold over.
 */
const JITTER = 0.2
/** Ring quads near the corners are sheared parallelograms, which tolerate less jitter. */
const RING_JITTER = 0.12

/** Tangent and outward normal of each side of a square ring, traversed clockwise from the north-west corner. */
const SIDES = [
  { tx: 1, tz: 0, ox: 0, oz: -1 },
  { tx: 0, tz: 1, ox: 1, oz: 0 },
  { tx: -1, tz: 0, ox: 0, oz: 1 },
  { tx: 0, tz: -1, ox: -1, oz: 0 },
]

/** Point at fraction `t` (0..1) around a square ring of half-size `s`. */
function ringPoint(s: number, t: number): [number, number] {
  const side = Math.min(3, Math.floor(t * 4))
  const f = t * 4 - side
  if (side === 0) return [-s + 2 * s * f, -s]
  if (side === 1) return [s, -s + 2 * s * f]
  if (side === 2) return [s - 2 * s * f, s]
  return [-s, s - 2 * s * f]
}

/** Triangulates the strip between two closed loops that start at the same corner and run the same way. */
function zip(inner: number[], outer: number[], out: number[]): void {
  const a = inner.length
  const b = outer.length
  for (let i = 0, j = 0; i < a || j < b; ) {
    if (j >= b || (i < a && (i + 1) / a <= (j + 1) / b)) {
      out.push(inner[i], inner[(i + 1) % a], outer[j % b])
      i++
    } else {
      out.push(outer[j], inner[i % a], outer[(j + 1) % b])
      j++
    }
  }
}

/** Two triangles per ring quad (a, b inner; c, d outer), split along the shorter diagonal. */
function pushQuad(out: number[], positions: Float32Array, a: number, b: number, c: number, d: number): void {
  const length = (p: number, q: number) =>
    (positions[p * 3] - positions[q * 3]) ** 2 + (positions[p * 3 + 2] - positions[q * 3 + 2]) ** 2
  if (length(b, c) <= length(a, d)) out.push(a, b, c, c, b, d)
  else out.push(a, b, d, a, d, c)
}

/**
 * Low-poly terrain with baked vertex colours: a fine grid over the playable area surrounded by
 * square rings that grow geometrically out to the horizon mountains. Both meshes share one
 * vertex buffer, so the seam between them is exact.
 */
export function buildTerrainMeshes(
  terrain: Terrain,
  palette: SurfacePaletteDef,
  options: TerrainMeshOptions,
): TerrainMeshes {
  const half = terrain.playableHalfSize
  const n = Math.max(1, Math.round((half * 2) / options.spacing))
  const step = (half * 2) / n
  const m = options.horizonSegments
  const growth = 1 + 3 / m
  const rings: number[] = []
  for (let s = half * growth; s < terrain.extent * 0.98; s *= growth) rings.push(s)
  rings.push(terrain.extent)

  const nearCount = (n + 1) * (n + 1)
  const ringCount = 4 * m
  const total = nearCount + rings.length * ringCount
  const positions = new Float32Array(total * 3)
  const colors = new Float32Array(total * 3)
  const rng = createRng(options.seed)
  const sample = createSample()
  const highlands = new Color(palette.highlands)
  const maria = new Color(palette.maria)
  const floor = new Color(palette.craterFloor)
  const ejecta = new Color(palette.ejecta)
  const color = new Color()

  const writeVertex = (index: number, x: number, z: number) => {
    terrain.sample(x, z, sample)
    const v = index * 3
    positions[v] = x
    positions[v + 1] = sample.height
    positions[v + 2] = z
    color
      .copy(maria)
      .lerp(highlands, sample.albedo)
      .lerp(floor, sample.craterInterior * 0.5)
      .lerp(ejecta, Math.min(1, sample.ejecta * 0.75 + sample.craterRim * 0.18))
    const grain = 0.93 + rng() * 0.14
    colors[v] = color.r * grain
    colors[v + 1] = color.g * grain
    colors[v + 2] = color.b * grain
  }

  for (let row = 0; row <= n; row++) {
    for (let col = 0; col <= n; col++) {
      let x = -half + col * step
      let z = -half + row * step
      if (col > 0 && col < n && row > 0 && row < n) {
        x += (rng() - 0.5) * 2 * JITTER * step
        z += (rng() - 0.5) * 2 * JITTER * step
      }
      writeVertex(row * (n + 1) + col, x, z)
    }
  }

  for (let k = 0; k < rings.length; k++) {
    const s = rings[k]
    const along = (2 * s) / m
    const across = s - (k > 0 ? rings[k - 1] : half)
    const last = k === rings.length - 1
    for (let i = 0; i < ringCount; i++) {
      let [x, z] = ringPoint(s, i / ringCount)
      if (!last && i % m !== 0) {
        const side = SIDES[Math.floor(i / m)]
        const a = (rng() - 0.5) * 2 * RING_JITTER * along
        const b = (rng() - 0.5) * 2 * RING_JITTER * across
        x += side.tx * a + side.ox * b
        z += side.tz * a + side.oz * b
      }
      writeVertex(nearCount + k * ringCount + i, x, z)
    }
  }

  const nearIndex: number[] = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const a = row * (n + 1) + col
      const b = a + 1
      const c = a + n + 1
      if (rng() < 0.5) nearIndex.push(a, c, b, b, c, c + 1)
      else nearIndex.push(a, c, c + 1, a, c + 1, b)
    }
  }

  // The playable area's boundary, in the same order as the rings: clockwise from the north-west corner.
  const boundary: number[] = []
  for (let col = 0; col < n; col++) boundary.push(col)
  for (let row = 0; row < n; row++) boundary.push(row * (n + 1) + n)
  for (let col = n; col > 0; col--) boundary.push(n * (n + 1) + col)
  for (let row = n; row > 0; row--) boundary.push(row * (n + 1))
  const ring = (k: number) => Array.from({ length: ringCount }, (_, i) => nearCount + k * ringCount + i)

  const farIndex: number[] = []
  zip(boundary, ring(0), farIndex)
  for (let k = 0; k < rings.length - 1; k++) {
    const base = nearCount + k * ringCount
    for (let i = 0; i < ringCount; i++) {
      const next = (i + 1) % ringCount
      pushQuad(farIndex, positions, base + i, base + next, base + ringCount + i, base + ringCount + next)
    }
  }

  const position = new BufferAttribute(positions, 3)
  const all = new BufferGeometry()
  all.setAttribute('position', position)
  all.setIndex([...nearIndex, ...farIndex])
  all.computeVertexNormals()
  const normal = all.getAttribute('normal')

  // Steep slopes expose darker, less weathered material.
  for (let i = 0; i < total; i++) {
    const shade = 1 - 0.22 * smoothstep(0.92, 0.55, normal.getY(i))
    colors[i * 3] *= shade
    colors[i * 3 + 1] *= shade
    colors[i * 3 + 2] *= shade
  }
  const color3 = new BufferAttribute(colors, 3)

  const make = (index: number[]) => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', position)
    geometry.setAttribute('normal', normal)
    geometry.setAttribute('color', color3)
    geometry.setIndex(new BufferAttribute(new Uint32Array(index), 1))
    geometry.computeBoundingSphere()
    return geometry
  }
  return { near: make(nearIndex), far: make(farIndex) }
}
