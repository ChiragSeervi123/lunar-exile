import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/*
 * Building blocks for flat-shaded, vertex-coloured models made of primitives: the astronaut, its
 * tool and mineral deposits. Each model merges into one geometry, so it costs one draw call.
 */

export type Vec = [number, number, number]

/** One piece of a model: a primitive with a flat colour, moved into place relative to the pivot. */
export function part(
  geometry: BufferGeometry,
  color: string,
  at: Vec = [0, 0, 0],
  rotate: Vec = [0, 0, 0],
  scale: Vec = [1, 1, 1],
): BufferGeometry {
  const piece = geometry.index ? geometry.toNonIndexed() : geometry
  if (piece !== geometry) geometry.dispose()
  piece.deleteAttribute('uv')
  piece.applyMatrix4(
    new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...rotate)), new Vector3(...scale)),
  )
  const { r, g, b } = new Color(color)
  const colors = new Float32Array(piece.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([r, g, b], i)
  piece.setAttribute('color', new BufferAttribute(colors, 3))
  return piece
}

/** Merges a model's pieces into one geometry with flat normals. */
export function segment(pieces: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  if (!merged) throw new Error('Model pieces have mismatched attributes')
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

export const cylinder = (top: number, bottom: number, height: number, sides = 7) =>
  new CylinderGeometry(top, bottom, height, sides)
export const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
export const rock = (radius: number, detail = 0) => new IcosahedronGeometry(radius, detail)
/** A double-ended point, for shards. */
export const shard = (radius: number) => new OctahedronGeometry(radius, 0)
