import { CAVE_LID, fromCaveLocal, toCaveLocal, type Cave, type CaveShape, type Planet } from '@/game/planet'
import { vec3, type Vec3 } from '@/utils/vec3'

/*
 * A cave's rock as low-poly meshes, one per 16 m block of its volume. Rock fills the cave's box
 * except its tunnels and chambers, under a thin lid just below the ground (so the cave never
 * pokes out), minus whatever has been dug out. Surfaces come from naive surface nets on a 1 m
 * lattice: one vertex per cell the surface crosses, quads across every crossed lattice edge.
 * Neighbouring blocks evaluate the same lattice points, so they meet exactly. No three.js here,
 * so it can be tested and built anywhere.
 */

/** Cells per block edge, and the lattice spacing, meters. */
export const BLOCK = 16
export const CELL = 1

export interface CaveBlockMesh {
  /** Block coordinates in the cave's lattice. */
  bx: number
  by: number
  bz: number
  /** Mesh origin, world space; positions are relative to it. */
  center: [number, number, number]
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

/** Ground height (local y) over each lattice column of a cave, worked out once and shared by its blocks. */
export interface CaveGround {
  heightAt(x: number, z: number): number
}

export function createCaveGround(planet: Planet, cave: Cave): CaveGround {
  const columns = new Map<number, number>()
  const world = vec3()
  const local = vec3()
  const dir = vec3()
  return {
    heightAt(x, z) {
      const key = (Math.round(x) + 512) * 1024 + (Math.round(z) + 512)
      let h = columns.get(key)
      if (h === undefined) {
        fromCaveLocal(cave, vec3(Math.round(x), 0, Math.round(z)), world)
        const r = Math.hypot(world.x, world.y, world.z)
        dir.x = world.x / r
        dir.y = world.y / r
        dir.z = world.z / r
        const s = planet.surfaceRadius(dir)
        h = toCaveLocal(cave, vec3(dir.x * s, dir.y * s, dir.z * s), local).y
        columns.set(key, h)
      }
      return h
    },
  }
}

/** Blocks covering a cave's volume, by lattice coordinates. */
export function caveBlocks(cave: Cave): { bx: number; by: number; bz: number }[] {
  const out: { bx: number; by: number; bz: number }[] = []
  const lo = (v: number) => Math.floor(v / (BLOCK * CELL))
  const hi = (v: number) => Math.floor(v / (BLOCK * CELL))
  for (let bx = lo(cave.min.x); bx <= hi(cave.max.x); bx++)
    for (let by = lo(cave.min.y); by <= hi(cave.max.y); by++)
      for (let bz = lo(cave.min.z); bz <= hi(cave.max.z); bz++) out.push({ bx, by, bz })
  return out
}

const ROCK = [0.29, 0.275, 0.255]
const DEEP = [0.2, 0.19, 0.185]

/**
 * Meshes one block, or returns null when it has no surface (solid rock, or open only above the
 * lid). `digs` is the cave's flat [x, y, z, radius] list.
 */
export function buildCaveBlock(cave: Cave, shape: CaveShape, ground: CaveGround, digs: readonly number[], bx: number, by: number, bz: number): CaveBlockMesh | null {
  const ox = bx * BLOCK * CELL
  const oy = by * BLOCK * CELL
  const oz = bz * BLOCK * CELL
  const size = BLOCK * CELL
  const min = vec3(ox - 2, oy - 2, oz - 2)
  const max = vec3(ox + size + 2, oy + size + 2, oz + size + 2)
  // Digs that reach this block.
  const near: number[] = []
  for (let i = 0; i + 3 < digs.length; i += 4) {
    const [x, y, z, r] = [digs[i], digs[i + 1], digs[i + 2], digs[i + 3]]
    if (x + r > min.x && x - r < max.x && y + r > min.y && y - r < max.y && z + r > min.z && z - r < max.z) near.push(x, y, z, r)
  }
  const local = shape.within(min, max)
  if (!local && near.length === 0) return null
  // The ground can't reach this block: nothing to cap.
  const N = BLOCK + 3 // lattice points per axis: -1 .. BLOCK + 1
  const field = new Float32Array(N * N * N)
  // Open space only (tunnels and digs), to tell real cave surfaces from the lid.
  const carved = new Float32Array(N * N * N)
  const at = (i: number, j: number, k: number) => ((k + 1) * N + (j + 1)) * N + (i + 1)
  const p = vec3()
  let sign = 0
  let mixed = false
  for (let k = -1; k <= BLOCK + 1; k++) {
    for (let j = -1; j <= BLOCK + 1; j++) {
      for (let i = -1; i <= BLOCK + 1; i++) {
        p.x = ox + i * CELL
        p.y = oy + j * CELL
        p.z = oz + k * CELL
        let open = local ? local.open(p) : 1e3
        for (let d = 0; d < near.length; d += 4) open = Math.min(open, Math.hypot(p.x - near[d], p.y - near[d + 1], p.z - near[d + 2]) - near[d + 3])
        // Rock under the lid only: above it is the ground's business, not the cave's.
        const lid = p.y > ground.heightAt(p.x, p.z) - CAVE_LID - 6 ? ground.heightAt(p.x, p.z) - CAVE_LID - p.y : 6
        const f = Math.min(open, lid)
        const n = at(i, j, k)
        field[n] = f
        carved[n] = open
        const s = f > 0 ? 1 : -1
        if (sign === 0) sign = s
        else if (s !== sign) mixed = true
      }
    }
  }
  if (!mixed) return null

  // One vertex per cell (cells -1 .. BLOCK) that the surface passes through.
  const C = BLOCK + 2
  const cellIndex = new Int32Array(C * C * C).fill(-1)
  const cellAt = (i: number, j: number, k: number) => ((k + 1) * C + (j + 1)) * C + (i + 1)
  const positions: number[] = []
  const corner = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ]
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const values = new Float32Array(8)
  for (let k = -1; k <= BLOCK; k++) {
    for (let j = -1; j <= BLOCK; j++) {
      for (let i = -1; i <= BLOCK; i++) {
        let inside = 0
        for (let c = 0; c < 8; c++) {
          values[c] = field[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])]
          if (values[c] > 0) inside++
        }
        if (inside === 0 || inside === 8) continue
        let sx = 0
        let sy = 0
        let sz = 0
        let count = 0
        for (const [a, b] of edges) {
          const va = values[a]
          const vb = values[b]
          if (va > 0 === vb > 0) continue
          const t = va / (va - vb)
          sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t
          sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t
          sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t
          count++
        }
        cellIndex[cellAt(i, j, k)] = positions.length / 3
        positions.push(ox + (i + sx / count) * CELL, oy + (j + sy / count) * CELL, oz + (k + sz / count) * CELL)
      }
    }
  }

  // A quad across every crossed lattice edge this block owns (edges starting inside it).
  const indices: number[] = []
  const quad = (a: number, b: number, c: number, d: number, towardAir: Vec3) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    // Wind so the face looks toward the open side.
    const ax = positions[a * 3]
    const ay = positions[a * 3 + 1]
    const az = positions[a * 3 + 2]
    const ux = positions[b * 3] - ax
    const uy = positions[b * 3 + 1] - ay
    const uz = positions[b * 3 + 2] - az
    const vx = positions[c * 3] - ax
    const vy = positions[c * 3 + 1] - ay
    const vz = positions[c * 3 + 2] - az
    const facing = (uy * vz - uz * vy) * towardAir.x + (uz * vx - ux * vz) * towardAir.y + (ux * vy - uy * vx) * towardAir.z
    if (facing >= 0) indices.push(a, b, c, a, c, d)
    else indices.push(a, c, b, a, d, c)
  }
  const air = vec3()
  for (let k = 0; k < BLOCK; k++) {
    for (let j = 0; j < BLOCK; j++) {
      for (let i = 0; i < BLOCK; i++) {
        const f0 = field[at(i, j, k)]
        for (let axis = 0; axis < 3; axis++) {
          const ni = i + (axis === 0 ? 1 : 0)
          const nj = j + (axis === 1 ? 1 : 0)
          const nk = k + (axis === 2 ? 1 : 0)
          const f1 = field[at(ni, nj, nk)]
          if (f0 > 0 === f1 > 0) continue
          // The open end: keep real cave surfaces (open because of a tunnel or a dig) and the lid
          // round the cave mouth, where the ground's hole is a little wider than the tunnel; not the
          // lid's underside anywhere else, which nothing can see.
          const airIsStart = f0 <= 0
          if ((airIsStart ? carved[at(i, j, k)] : carved[at(ni, nj, nk)]) > 2) continue
          const s = airIsStart ? -1 : 1
          air.x = axis === 0 ? s : 0
          air.y = axis === 1 ? s : 0
          air.z = axis === 2 ? s : 0
          if (axis === 0) quad(cellIndex[cellAt(i, j - 1, k - 1)], cellIndex[cellAt(i, j, k - 1)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i, j - 1, k)], air)
          else if (axis === 1) quad(cellIndex[cellAt(i - 1, j, k - 1)], cellIndex[cellAt(i - 1, j, k)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i, j, k - 1)], air)
          else quad(cellIndex[cellAt(i - 1, j - 1, k)], cellIndex[cellAt(i, j - 1, k)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i - 1, j, k)], air)
        }
      }
    }
  }
  if (indices.length === 0) return null

  // To world space, relative to the block's centre; darker rock deeper down.
  const center = fromCaveLocal(cave, vec3(ox + size / 2, oy + size / 2, oz + size / 2), vec3())
  const out = new Float32Array(positions.length)
  const colors = new Float32Array(positions.length)
  const w = vec3()
  for (let v = 0; v < positions.length; v += 3) {
    fromCaveLocal(cave, vec3(positions[v], positions[v + 1], positions[v + 2]), w)
    out[v] = w.x - center.x
    out[v + 1] = w.y - center.y
    out[v + 2] = w.z - center.z
    const deep = Math.min(1, Math.max(0, -positions[v + 1] / 30))
    const grain = 0.9 + 0.2 * (((Math.sin(positions[v] * 12.9898 + positions[v + 1] * 78.233 + positions[v + 2] * 37.719) * 43758.5453) % 1) + 1) % 1
    for (let c = 0; c < 3; c++) colors[v + c] = (ROCK[c] + (DEEP[c] - ROCK[c]) * deep) * grain
  }
  return { bx, by, bz, center: [center.x, center.y, center.z], positions: out, colors, indices: Uint32Array.from(indices) }
}
