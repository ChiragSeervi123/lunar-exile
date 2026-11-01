import { normalize, type Vec3 } from '@/utils/vec3'

/*
 * The Moon's surface is parameterised as a cube projected onto the sphere: six faces, each a square
 * of parameters (s, t) in [-1, 1]. The projection is equi-angular (tan-warped), so cells stay
 * within about 1.4x of each other in size instead of bunching up at the cube's corners. Faces are
 * subdivided as quadtrees for level of detail and streaming.
 */

/** A cube face: its outward normal and the two in-face axes, with u × v = normal. */
export interface CubeFace {
  normal: Vec3
  u: Vec3
  v: Vec3
}

/**
 * The six faces. The +Y face (index 2) is centred on the landing site, with u pointing east (+X)
 * and v north (−Z), matching the flat landing-site map.
 */
export const CUBE_FACES: readonly CubeFace[] = [
  { normal: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 1, z: 0 } },
  { normal: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  { normal: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } },
  { normal: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  { normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  { normal: { x: 0, y: 0, z: -1 }, u: { x: -1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
]

const QUARTER = Math.PI / 4

/** tan(p·π/4), exact at the face edges so neighbouring faces produce identical edge points. */
function warp(p: number): number {
  if (p === 1) return 1
  if (p === -1) return -1
  if (p === 0) return 0
  return Math.tan(p * QUARTER)
}

/** Unit direction for face parameters (s, t) in [-1, 1]. Parameters a little outside still work. */
export function faceDirection(face: number, s: number, t: number, out: Vec3): Vec3 {
  const f = CUBE_FACES[face]
  const a = warp(s)
  const b = warp(t)
  out.x = f.normal.x + a * f.u.x + b * f.v.x
  out.y = f.normal.y + a * f.u.y + b * f.v.y
  out.z = f.normal.z + a * f.u.z + b * f.v.z
  return normalize(out, out)
}

export interface FacePoint {
  face: number
  s: number
  t: number
}

/** The face a unit direction falls on, and its parameters there. Inverse of `faceDirection`. */
export function faceOf(dir: Vec3, out: FacePoint): FacePoint {
  const ax = Math.abs(dir.x)
  const ay = Math.abs(dir.y)
  const az = Math.abs(dir.z)
  let face: number
  if (ax >= ay && ax >= az) face = dir.x >= 0 ? 0 : 1
  else if (ay >= az) face = dir.y >= 0 ? 2 : 3
  else face = dir.z >= 0 ? 4 : 5
  const f = CUBE_FACES[face]
  const k = dir.x * f.normal.x + dir.y * f.normal.y + dir.z * f.normal.z
  out.face = face
  out.s = Math.atan((dir.x * f.u.x + dir.y * f.u.y + dir.z * f.u.z) / k) / QUARTER
  out.t = Math.atan((dir.x * f.v.x + dir.y * f.v.y + dir.z * f.v.z) / k) / QUARTER
  return out
}

/** A quadtree node on a face: at `depth` the face has 2^depth × 2^depth nodes, indexed from (−1, −1). */
export interface CubeNode {
  face: number
  depth: number
  ix: number
  iy: number
}

/** Deepest quadtree level supported by node keys. */
export const MAX_NODE_DEPTH = 11

/** A unique number per node, for maps and sets. */
export function nodeKey(face: number, depth: number, ix: number, iy: number): number {
  return ((depth * 6 + face) * 4096 + ix) * 4096 + iy
}

/**
 * Face parameter of grid line `index` on a face divided into `cells` cells per side. Exact when
 * `cells` is a power of two, so the same grid point always gets the same parameter.
 */
export function gridParam(index: number, cells: number): number {
  return (2 * index - cells) / cells
}

/** Nominal edge length of a node at `depth`, meters along the surface. */
export function nodeSize(radius: number, depth: number): number {
  return ((Math.PI / 2) * radius) / 2 ** depth
}
