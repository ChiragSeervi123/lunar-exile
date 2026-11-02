import { createPlanetSample, faceDirection, gridParam, nodeKey, nodeSize, type CubeNode, type Planet } from '@/game/planet'
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
  indices: Uint16Array | Uint32Array
  /** Bounding sphere radius around `center`, meters. */
  radius: number
  /** Ground height range in the chunk, relative to the planet radius. */
  minHeight: number
  maxHeight: number
  /** Build time, ms. */
  buildMs: number
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
  const dir = vec3()
  let minHeight = Infinity
  let maxHeight = -Infinity

  const centerDir = faceDirection(face, gridParam(ix * res + res / 2, cells), gridParam(iy * res + res / 2, cells), vec3())
  const cx = centerDir.x * R
  const cy = centerDir.y * R
  const cz = centerDir.z * R
  const spread = (options.jitter * 2) / cells

  for (let j = -1; j <= res + 1; j++) {
    for (let i = -1; i <= res + 1; i++) {
      const gi = ix * res + i
      const gj = iy * res + j
      let s = gridParam(gi, cells)
      let t = gridParam(gj, cells)
      // Jitter every point inside the face; points on the face's own edge stay put so the
      // neighbouring face meets them exactly.
      if (gi > 0 && gi < cells && gj > 0 && gj < cells) {
        s += (hash(seed, face, depth, gi, gj, SALT_JITTER_S) - 0.5) * spread
        t += (hash(seed, face, depth, gi, gj, SALT_JITTER_T) - 0.5) * spread
      }
      faceDirection(face, s, t, dir)
      const inside = i >= 0 && i <= res && j >= 0 && j <= res
      let r: number
      if (inside && render) {
        planet.sample(dir, sample)
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
      } else r = planet.surfaceRadius(dir)
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

  const skirtCount = render ? 4 * res : 0
  const vertexCount = n * n + skirtCount
  const positions = new Float32Array(vertexCount * 3)
  const normals = render ? new Float32Array(vertexCount * 3) : null
  const colors = render ? new Float32Array(vertexCount * 3) : null
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
      radius2 = Math.max(radius2, px * px + py * py + pz * pz)
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
      // Colour as on the flat map: maria to highlands by albedo, darker crater floors, bright
      // ejecta and rims, a province's tint, per-vertex grain, and darker steep slopes.
      const p = options.palette!
      const a = albedo![v]
      let r = p.maria[0] + (p.highlands[0] - p.maria[0]) * a
      let gr = p.maria[1] + (p.highlands[1] - p.maria[1]) * a
      let b = p.maria[2] + (p.highlands[2] - p.maria[2]) * a
      const f = interior![v] * 0.5
      r += (p.craterFloor[0] - r) * f
      gr += (p.craterFloor[1] - gr) * f
      b += (p.craterFloor[2] - b) * f
      const e = Math.min(1, ejecta![v] * 0.75 + rim![v] * 0.18)
      r += (p.ejecta[0] - r) * e
      gr += (p.ejecta[1] - gr) * e
      b += (p.ejecta[2] - b) * e
      const ta = tint![v * 4 + 3]
      if (ta > 0) {
        r += (tint![v * 4] - r) * ta
        gr += (tint![v * 4 + 1] - gr) * ta
        b += (tint![v * 4 + 2] - b) * ta
      }
      const radial = Math.hypot(wx[k], wy[k], wz[k])
      const upness = (nx * wx[k] + ny * wy[k] + nz * wz[k]) / radial
      const grain = 0.93 + 0.14 * hash(seed, face, depth, ix * res + i, iy * res + j, SALT_GRAIN)
      const shade = grain * (1 - 0.22 * smoothstep(0.92, 0.55, upness))
      colors[v * 3] = r * shade
      colors[v * 3 + 1] = gr * shade
      colors[v * 3 + 2] = b * shade
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
      const s = n * n + e
      const px = positions[v * 3] + cx
      const py = positions[v * 3 + 1] + cy
      const pz = positions[v * 3 + 2] + cz
      const l = Math.hypot(px, py, pz)
      const qx = positions[v * 3] - (px / l) * drop
      const qy = positions[v * 3 + 1] - (py / l) * drop
      const qz = positions[v * 3 + 2] - (pz / l) * drop
      positions[s * 3] = qx
      positions[s * 3 + 1] = qy
      positions[s * 3 + 2] = qz
      radius2 = Math.max(radius2, qx * qx + qy * qy + qz * qz)
      for (let c = 0; c < 3; c++) {
        normals![s * 3 + c] = normals![v * 3 + c]
        colors![s * 3 + c] = colors![v * 3 + c] * 0.7
      }
    })
  }

  const indexCount = res * res * 6 + skirtCount * 6
  const indices = vertexCount < 65536 ? new Uint16Array(indexCount) : new Uint32Array(indexCount)
  let w = 0
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = j * n + i
      const b = a + 1
      const c = a + n
      const d = c + 1
      // Counter-clockwise seen from outside (u right, v up); the diagonal varies per quad.
      if (hash(seed, face, depth, ix * res + i, iy * res + j, SALT_DIAGONAL) < 0.5) {
        indices[w++] = a
        indices[w++] = b
        indices[w++] = d
        indices[w++] = a
        indices[w++] = d
        indices[w++] = c
      } else {
        indices[w++] = a
        indices[w++] = b
        indices[w++] = c
        indices[w++] = b
        indices[w++] = d
        indices[w++] = c
      }
    }
  }
  // Edges were listed counter-clockwise around the chunk, so outward is always to the right.
  for (let e = 0; e < skirtCount; e++) {
    const p0 = edge[e]
    const p1 = edge[(e + 1) % skirtCount]
    const s0 = n * n + e
    const s1 = n * n + ((e + 1) % skirtCount)
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
    indices,
    radius: Math.sqrt(radius2),
    minHeight,
    maxHeight,
    buildMs: performance.now() - started,
  }
}
