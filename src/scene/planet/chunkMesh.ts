import { createCaveQueries, createPlanetSample, faceDirection, gridParam, nodeKey, nodeSize, OPEN_AT, type CaveQueries, type CubeNode, type Planet } from '@/game/planet'
import { smoothstep } from '@/utils/math'
import { vec3 } from '@/utils/vec3'

/*
 * Builds one Moon terrain chunk as plain typed arrays: no three.js here, so chunks can be built in a
 * Web Worker and the same code serves rendering and physics. Every grid point is placed from its
 * global grid coordinates (jitter and triangle diagonals included), so neighbouring chunks of the
 * same detail share their edges exactly; skirts hide the steps between chunks of different detail.
 */

export type RGB = [number, number, number]

/** Surface colours, linear RGB (as three.js stores vertex colours). */
export interface ChunkPalette {
  highlands: RGB
  maria: RGB
  craterFloor: RGB
  ejecta: RGB
}

export interface ChunkMeshOptions {
  /** Quads along each side. */
  resolution: number
  /** Vertex jitter as a fraction of the grid spacing. */
  jitter: number
  /** Colours, normals and skirts for drawing; null builds the bare surface (for physics). */
  palette: ChunkPalette | null
}

export interface ChunkMesh {
  key: number
  node: CubeNode
  /** Mesh origin, world space; positions are relative to it. */
  center: [number, number, number]
  positions: Float32Array
  normals: Float32Array | null
  colors: Float32Array | null
  /** 1 on skirt vertices, 0 on the ground (drawing only). */
  skirt: Uint8Array | null
  indices: Uint16Array | Uint32Array
  /** Bounding sphere radius around `center`, meters. */
  radius: number
  /** Ground height range in the chunk, relative to the planet radius. */
  minHeight: number
  maxHeight: number
  /** Build time, ms. */
  buildMs: number
}

/**
 * The ground's colour as on the flat map: maria to highlands by albedo, darker crater floors,
 * bright ejecta and rims, and a province's tint (amount `ta`). No grain or slope shading. Writes
 * into `out` and returns it.
 */
export function surfaceColor(
  p: ChunkPalette,
  albedo: number,
  interior: number,
  rim: number,
  ejecta: number,
  tr: number,
  tg: number,
  tb: number,
  ta: number,
  out: RGB,
): RGB {
  let r = p.maria[0] + (p.highlands[0] - p.maria[0]) * albedo
  let g = p.maria[1] + (p.highlands[1] - p.maria[1]) * albedo
  let b = p.maria[2] + (p.highlands[2] - p.maria[2]) * albedo
  const f = interior * 0.5
  r += (p.craterFloor[0] - r) * f
  g += (p.craterFloor[1] - g) * f
  b += (p.craterFloor[2] - b) * f
  const e = Math.min(1, ejecta * 0.75 + rim * 0.18)
  r += (p.ejecta[0] - r) * e
  g += (p.ejecta[1] - g) * e
  b += (p.ejecta[2] - b) * e
  if (ta > 0) {
    r += (tr - r) * ta
    g += (tg - g) * ta
    b += (tb - b) * ta
  }
  out[0] = r
  out[1] = g
  out[2] = b
  return out
}

/** A well-mixed 32-bit hash of grid coordinates, as a fraction in [0, 1). */
function hash(seed: number, face: number, depth: number, x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((face << 4) | depth, 0x9e3779b1)
  h ^= Math.imul(seed ^ salt, 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const SALT_JITTER_S = 0x51ed27
const SALT_JITTER_T = 0x3a9f11
const SALT_DIAGONAL = 0x6c8e99
const SALT_GRAIN = 0x1b873d

export function buildChunkMesh(planet: Planet, node: CubeNode, options: ChunkMeshOptions): ChunkMesh {
  const started = performance.now()
  const { face, depth, ix, iy } = node
  const res = options.resolution
  const cells = res * 2 ** depth
  const R = planet.radius
  const seed = planet.seed
  const render = options.palette !== null
  // Sample grid with a one-point border all round, for normals at the chunk's edges.
  const g = res + 3
  const wx = new Float64Array(g * g)
  const wy = new Float64Array(g * g)
  const wz = new Float64Array(g * g)
  const n = res + 1
  const albedo = render ? new Float32Array(n * n) : null
  const interior = render ? new Float32Array(n * n) : null
  const rim = render ? new Float32Array(n * n) : null
  const ejecta = render ? new Float32Array(n * n) : null
  const tint = render ? new Float32Array(n * n * 4) : null
  const sample = createPlanetSample()
  const rgb: RGB = [0, 0, 0]
  const dir = vec3()
  let minHeight = Infinity
  let maxHeight = -Infinity

  const centerDir = faceDirection(face, gridParam(ix * res + res / 2, cells), gridParam(iy * res + res / 2, cells), vec3())
  const cx = centerDir.x * R
  const cy = centerDir.y * R
  const cz = centerDir.z * R
  const spread = (options.jitter * 2) / cells
  // Vertex spacing: features smaller than this can't show, so they aren't sampled.
  const spacing = nodeSize(R, depth) / res

  // The border is only needed for normals, so physics meshes skip it.
  const border = render ? 1 : 0
  for (let j = -border; j <= res + border; j++) {
    for (let i = -border; i <= res + border; i++) {
      const gi = ix * res + i
      const gj = iy * res + j
      let s = gridParam(gi, cells)
      let t = gridParam(gj, cells)
      // Jitter every point inside the face; points on the face's own edge stay put so the
      // neighbouring face meets them exactly. Points on a chunk border only move along it: borders
      // then stay on the same great circle at every detail level, so a finer chunk meets a coarser
      // one with no sideways sliver between them (the skirts cover the remaining vertical step).
      if (gi > 0 && gi < cells && gj > 0 && gj < cells) {
        if (gi % res !== 0) s += (hash(seed, face, depth, gi, gj, SALT_JITTER_S) - 0.5) * spread
        if (gj % res !== 0) t += (hash(seed, face, depth, gi, gj, SALT_JITTER_T) - 0.5) * spread
      }
      faceDirection(face, s, t, dir)
      const inside = i >= 0 && i <= res && j >= 0 && j <= res
      let r: number
      if (inside && render) {
        planet.sample(dir, sample, spacing)
        const v = j * n + i
        albedo![v] = sample.albedo
        interior![v] = sample.craterInterior
        rim![v] = sample.craterRim
        ejecta![v] = sample.ejecta
        tint![v * 4] = sample.tintR
        tint![v * 4 + 1] = sample.tintG
        tint![v * 4 + 2] = sample.tintB
        tint![v * 4 + 3] = sample.tintAmount
        r = R + sample.height
      } else r = planet.surfaceRadius(dir, spacing)
      if (inside) {
        minHeight = Math.min(minHeight, r - R)
        maxHeight = Math.max(maxHeight, r - R)
      }
      const k = (j + 1) * g + (i + 1)
      wx[k] = dir.x * r
      wy[k] = dir.y * r
      wz[k] = dir.z * r
    }
  }

  // Skirt vertices: a top row (copies of the edge) and a bottom row, so every skirt triangle is
  // made of skirt vertices only and can be shaded as the ground it hangs from.
  const skirtCount = render ? 4 * res : 0
  const vertexCount = n * n + 2 * skirtCount
  const positions = new Float32Array(vertexCount * 3)
  const normals = render ? new Float32Array(vertexCount * 3) : null
  const colors = render ? new Float32Array(vertexCount * 3) : null
  const skirt = render ? new Uint8Array(vertexCount) : null
  let radius2 = 0

  for (let j = 0; j <= res; j++) {
    for (let i = 0; i <= res; i++) {
      const k = (j + 1) * g + (i + 1)
      const v = j * n + i
      const px = wx[k] - cx
      const py = wy[k] - cy
      const pz = wz[k] - cz
      positions[v * 3] = px
      positions[v * 3 + 1] = py
      positions[v * 3 + 2] = pz
      // Bounds from the stored (float32) values, so they cover exactly what is drawn.
      radius2 = Math.max(radius2, positions[v * 3] ** 2 + positions[v * 3 + 1] ** 2 + positions[v * 3 + 2] ** 2)
      if (!normals || !colors) continue
      // Normal from the neighbouring grid points (u × v points outward on every face).
      const ux = wx[k + 1] - wx[k - 1]
      const uy = wy[k + 1] - wy[k - 1]
      const uz = wz[k + 1] - wz[k - 1]
      const vx = wx[k + g] - wx[k - g]
      const vy = wy[k + g] - wy[k - g]
      const vz = wz[k + g] - wz[k - g]
      let nx = uy * vz - uz * vy
      let ny = uz * vx - ux * vz
      let nz = ux * vy - uy * vx
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl
      ny /= nl
      nz /= nl
      normals[v * 3] = nx
      normals[v * 3 + 1] = ny
      normals[v * 3 + 2] = nz
      // Colour (see surfaceColor), per-vertex grain, and darker steep slopes.
      surfaceColor(options.palette!, albedo![v], interior![v], rim![v], ejecta![v], tint![v * 4], tint![v * 4 + 1], tint![v * 4 + 2], tint![v * 4 + 3], rgb)
      const radial = Math.hypot(wx[k], wy[k], wz[k])
      const upness = (nx * wx[k] + ny * wy[k] + nz * wz[k]) / radial
      const grain = 0.93 + 0.14 * hash(seed, face, depth, ix * res + i, iy * res + j, SALT_GRAIN)
      const shade = grain * (1 - 0.22 * smoothstep(0.92, 0.55, upness))
      colors[v * 3] = rgb[0] * shade
      colors[v * 3 + 1] = rgb[1] * shade
      colors[v * 3 + 2] = rgb[2] * shade
    }
  }

  // Skirts: a strip hanging down from every edge, deep enough to cover the gap to a coarser neighbour.
  const edge: number[] = []
  if (render) {
    for (let i = 0; i < res; i++) edge.push(i) // bottom, left to right
    for (let j = 0; j < res; j++) edge.push(j * n + res) // right, upward
    for (let i = res; i > 0; i--) edge.push(res * n + i) // top, right to left
    for (let j = res; j > 0; j--) edge.push(j * n) // left, downward
    const drop = Math.max(2, (nodeSize(R, depth) / res) * 1.5)
    edge.forEach((v, e) => {
      const top = n * n + e
      const s = n * n + skirtCount + e
      const px = positions[v * 3] + cx
      const py = positions[v * 3 + 1] + cy
      const pz = positions[v * 3 + 2] + cz
      const l = Math.hypot(px, py, pz)
      positions[s * 3] = positions[v * 3] - (px / l) * drop
      positions[s * 3 + 1] = positions[v * 3 + 1] - (py / l) * drop
      positions[s * 3 + 2] = positions[v * 3 + 2] - (pz / l) * drop
      radius2 = Math.max(radius2, positions[s * 3] ** 2 + positions[s * 3 + 1] ** 2 + positions[s * 3 + 2] ** 2)
      for (let c = 0; c < 3; c++) {
        positions[top * 3 + c] = positions[v * 3 + c]
        normals![top * 3 + c] = normals![s * 3 + c] = normals![v * 3 + c]
        colors![top * 3 + c] = colors![s * 3 + c] = colors![v * 3 + c]
      }
      skirt![top] = 1
      skirt![s] = 1
    })
  }

  // Cave mouths: ground opening into a cave's tunnels is left out (detailed chunks only; from far
  // away a hole couldn't be seen), so the astronaut can walk in and see down.
  const open = holes(planet, cx, cy, cz, Math.sqrt(radius2), spacing, wx, wy, wz, g, res)
  const indexCount = res * res * 6 + skirtCount * 6
  const full = vertexCount < 65536 ? new Uint16Array(indexCount) : new Uint32Array(indexCount)
  let w = 0
  const triangle = (a: number, b: number, c: number) => {
    if (open && opensOver(open, a, b, c, spacing, n, g, wx, wy, wz)) return
    full[w++] = a
    full[w++] = b
    full[w++] = c
  }
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = j * n + i
      const b = a + 1
      const c = a + n
      const d = c + 1
      // Counter-clockwise seen from outside (u right, v up); the diagonal varies per quad.
      if (hash(seed, face, depth, ix * res + i, iy * res + j, SALT_DIAGONAL) < 0.5) {
        triangle(a, b, d)
        triangle(a, d, c)
      } else {
        triangle(a, b, c)
        triangle(b, d, c)
      }
    }
  }
  const indices = full
  // Edges were listed counter-clockwise around the chunk, so outward is always to the right.
  for (let e = 0; e < skirtCount; e++) {
    const p0 = n * n + e
    const p1 = n * n + ((e + 1) % skirtCount)
    const s0 = p0 + skirtCount
    const s1 = p1 + skirtCount
    indices[w++] = p0
    indices[w++] = s0
    indices[w++] = p1
    indices[w++] = p1
    indices[w++] = s0
    indices[w++] = s1
  }

  return {
    key: nodeKey(face, depth, ix, iy),
    node: { face, depth, ix, iy },
    center: [cx, cy, cz],
    positions,
    normals,
    colors,
    skirt,
    indices: w < indices.length ? indices.slice(0, w) : indices,
    radius: Math.sqrt(radius2),
    minHeight,
    maxHeight,
    buildMs: performance.now() - started,
  }
}

/** Finest spacing at which cave mouths are cut, meters (coarser chunks are too far away to show them). */
const HOLE_SPACING = 3
const queriesByPlanet = new WeakMap<Planet, CaveQueries>()

interface Holes {
  /** Per ground vertex: how far from a cave's open space (see CaveQueries.openness). */
  openness: Float32Array
  queries: CaveQueries
}

/** Where the chunk's ground opens into caves below; null when no cave mouth reaches it. */
function holes(planet: Planet, cx: number, cy: number, cz: number, radius: number, spacing: number, wx: Float64Array, wy: Float64Array, wz: Float64Array, g: number, res: number): Holes | null {
  if (spacing > HOLE_SPACING || planet.caves.length === 0) return null
  let queries = queriesByPlanet.get(planet)
  if (!queries) queriesByPlanet.set(planet, (queries = createCaveQueries(planet)))
  if (queries.near(vec3(cx, cy, cz), radius).length === 0) return null
  const n = res + 1
  const openness = new Float32Array(n * n)
  const p = vec3()
  // Only a triangle with a corner this close can have open space inside it.
  let any = false
  for (let j = 0; j <= res; j++) {
    for (let i = 0; i <= res; i++) {
      const k = (j + 1) * g + (i + 1)
      p.x = wx[k]
      p.y = wy[k]
      p.z = wz[k]
      const o = queries.openness(p)
      openness[j * n + i] = o
      if (o < spacing * 2) any = true
    }
  }
  return any ? { openness, queries } : null
}

const probe = vec3()

/**
 * Whether ground triangle (a, b, c) (grid vertices) must be left out over a cave mouth: any corner
 * opens into the cave, or (for a triangle near one) its middle or an edge's middle does, so no
 * triangle bridges a narrow part of the opening.
 */
function opensOver(h: Holes, a: number, b: number, c: number, spacing: number, n: number, g: number, wx: Float64Array, wy: Float64Array, wz: Float64Array): boolean {
  const o = h.openness
  if (o[a] < OPEN_AT || o[b] < OPEN_AT || o[c] < OPEN_AT) return true
  if (Math.min(o[a], o[b], o[c]) > spacing * 2) return false
  const ka = (Math.floor(a / n) + 1) * g + (a % n) + 1
  const kb = (Math.floor(b / n) + 1) * g + (b % n) + 1
  const kc = (Math.floor(c / n) + 1) * g + (c % n) + 1
  const at = (u: number, v: number, w: number) => {
    probe.x = wx[ka] * u + wx[kb] * v + wx[kc] * w
    probe.y = wy[ka] * u + wy[kb] * v + wy[kc] * w
    probe.z = wz[ka] * u + wz[kb] * v + wz[kc] * w
    return h.queries.opensAt(probe)
  }
  return at(1 / 3, 1 / 3, 1 / 3) || at(0.5, 0.5, 0) || at(0, 0.5, 0.5) || at(0.5, 0, 0.5)
}
