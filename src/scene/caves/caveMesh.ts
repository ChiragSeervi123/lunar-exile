import { CAVE_LID, createPlanetSample, fromCaveLocal, toCaveLocal, type Cave, type CaveShape, type Planet } from '@/game/planet'
import { surfaceColor, type ChunkPalette, type RGB } from '@/scene/planet/chunkMesh'
import { normalize, vec3 } from '@/utils/vec3'

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
  /**
   * How much of the sky (sunlight, earthshine) reaches each vertex, 0..1: all of it at the mouth,
   * none a few meters down. The shadow map is far too coarse to keep it out of the rock by itself.
   */
  sky: Float32Array
  indices: Uint32Array
}

function dist2(p: readonly number[], a: number, b: number): number {
  const x = p[a * 3] - p[b * 3]
  const y = p[a * 3 + 1] - p[b * 3 + 1]
  const z = p[a * 3 + 2] - p[b * 3 + 2]
  return x * x + y * y + z * z
}

/**
 * The lid is kept this far (m) from the cave's open space: past the edge of the ground's hole over
 * the mouth, which drops whole terrain triangles (up to 3 m across, so over 4 m corner to corner)
 * that touch open space. Less, and slivers of sky show round the rim.
 */
const LID_MARGIN = 5

/** Sky light fades from full this far under the ground to none at SKY_NONE, meters. */
const SKY_FULL = 0.6
const SKY_NONE = 4.5

/** Ground height (local y) over each lattice column of a cave, worked out once and shared by its blocks. */
export interface CaveGround {
  heightAt(x: number, z: number): number
  /** The ground's own colour over a column (as the terrain draws it), or null without a palette. */
  colorAt(x: number, z: number): RGB | null
}

export function createCaveGround(planet: Planet, cave: Cave, palette: ChunkPalette | null = null): CaveGround {
  const columns = new Map<number, number>()
  const colors = new Map<number, RGB>()
  const sample = createPlanetSample()
  const world = vec3()
  const local = vec3()
  const dir = vec3()
  return {
    colorAt(x, z) {
      if (!palette) return null
      const key = (Math.round(x) + 512) * 1024 + (Math.round(z) + 512)
      let c = colors.get(key)
      if (!c) {
        normalize(dir, fromCaveLocal(cave, vec3(Math.round(x), 0, Math.round(z)), world))
        const s = planet.sample(dir, sample)
        c = surfaceColor(palette, s.albedo, s.craterInterior, s.craterRim, s.ejecta, s.tintR, s.tintG, s.tintB, s.tintAmount, [0, 0, 0])
        colors.set(key, c)
      }
      return c
    },
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

  // A quad across every crossed lattice edge this block owns (edges starting inside it). The four
  // cells round an edge are listed counter-clockwise seen from the edge's far (+) end, so the
  // winding follows from which end is open, not from where the vertices happen to sit: the
  // vertices move inside their cells, and a winding read off the geometry flips (and gets culled,
  // leaving a hole) wherever a quad folds.
  const indices: number[] = []
  const quad = (a: number, b: number, c: number, d: number, airAhead: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    // Split along the shorter diagonal: flatter, fewer slivers.
    const ac = dist2(positions, a, c)
    const bd = dist2(positions, b, d)
    if (airAhead) {
      if (ac <= bd) indices.push(a, b, c, a, c, d)
      else indices.push(a, b, d, b, c, d)
    } else if (ac <= bd) indices.push(a, c, b, a, d, c)
    else indices.push(a, d, b, b, d, c)
  }
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
          if ((airIsStart ? carved[at(i, j, k)] : carved[at(ni, nj, nk)]) > LID_MARGIN) continue
          const ahead = !airIsStart
          if (axis === 0) quad(cellIndex[cellAt(i, j - 1, k - 1)], cellIndex[cellAt(i, j, k - 1)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i, j - 1, k)], ahead)
          else if (axis === 1) quad(cellIndex[cellAt(i - 1, j, k - 1)], cellIndex[cellAt(i - 1, j, k)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i, j, k - 1)], ahead)
          else quad(cellIndex[cellAt(i - 1, j - 1, k)], cellIndex[cellAt(i, j - 1, k)], cellIndex[cellAt(i, j, k)], cellIndex[cellAt(i - 1, j, k)], ahead)
        }
      }
    }
  }
  if (indices.length === 0) return null

  // To world space, relative to the block's centre; darker rock deeper down.
  const center = fromCaveLocal(cave, vec3(ox + size / 2, oy + size / 2, oz + size / 2), vec3())
  const out = new Float32Array(positions.length)
  const colors = new Float32Array(positions.length)
  const sky = new Float32Array(positions.length / 3)
  const w = vec3()
  for (let v = 0; v < positions.length; v += 3) {
    fromCaveLocal(cave, vec3(positions[v], positions[v + 1], positions[v + 2]), w)
    out[v] = w.x - center.x
    out[v + 1] = w.y - center.y
    out[v + 2] = w.z - center.z
    const deep = Math.min(1, Math.max(0, -positions[v + 1] / 30))
    const noise = (Math.sin(positions[v] * 12.9898 + positions[v + 1] * 78.233 + positions[v + 2] * 37.719) * 43758.5453) % 1
    const grain = 0.9 + 0.2 * ((noise + 1) % 1)
    const under = ground.heightAt(positions[v], positions[v + 2]) - positions[v + 1]
    const t = Math.min(1, Math.max(0, (under - SKY_FULL) / (SKY_NONE - SKY_FULL)))
    const open = 1 - t * t * (3 - 2 * t)
    sky[v / 3] = open
    // Right under the ground (the lid and the mouth's lip) the rock takes the ground's colour, so
    // the lip and any of the lid seen round the mouth blend into the terrain.
    const top = open > 0 ? ground.colorAt(positions[v], positions[v + 2]) : null
    for (let c = 0; c < 3; c++) {
      const rock = ROCK[c] + (DEEP[c] - ROCK[c]) * deep
      colors[v + c] = (top ? rock + (top[c] - rock) * open : rock) * grain
    }
  }
  return { bx, by, bz, center: [center.x, center.y, center.z], positions: out, colors, sky, indices: Uint32Array.from(indices) }
}
