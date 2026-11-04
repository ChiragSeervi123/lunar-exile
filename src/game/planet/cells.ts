import { clamp } from '@/utils/math'
import { dot, vec3, type Vec3 } from '@/utils/vec3'
import { faceDirection, faceOf, gridParam, nodeKey, type CubeNode, type FacePoint } from './cubeSphere'

/*
 * Fixed-size cells of the cube-sphere (all the nodes of one quadtree depth), for anything streamed
 * around the player at a single scale: collision tiles, rock fields. Neighbour search crosses cube
 * edges and corners, so streaming works the same everywhere on the Moon.
 */

const point: FacePoint = { face: 0, s: 0, t: 0 }

/** The node at `depth` containing unit direction `dir`. */
export function nodeAt(dir: Vec3, depth: number, out: CubeNode): CubeNode {
  faceOf(dir, point)
  const cells = 2 ** depth
  out.face = point.face
  out.depth = depth
  out.ix = clamp(Math.floor(((point.s + 1) / 2) * cells), 0, cells - 1)
  out.iy = clamp(Math.floor(((point.t + 1) / 2) * cells), 0, cells - 1)
  return out
}

/** Unit direction of a node's centre. */
export function nodeCenter(node: CubeNode, out: Vec3): Vec3 {
  const cells = 2 ** node.depth
  return faceDirection(node.face, gridParam(2 * node.ix + 1, 2 * cells), gridParam(2 * node.iy + 1, 2 * cells), out)
}

const corner = vec3()

/** Angle from a node's centre direction to its farthest corner, radians. */
export function nodeReach(node: CubeNode, center: Vec3): number {
  const cells = 2 ** node.depth
  let reach = 0
  for (let k = 0; k < 4; k++) {
    faceDirection(node.face, gridParam(node.ix + (k & 1), cells), gridParam(node.iy + (k >> 1), cells), corner)
    reach = Math.max(reach, Math.acos(clamp(dot(corner, center), -1, 1)))
  }
  return reach
}

/** Area of a node on a sphere of radius `radius`, m² (from its corners; within 0.1% at depth 4 and finer). */
export function nodeArea(node: CubeNode, radius: number): number {
  const cells = 2 ** node.depth
  const c = [vec3(), vec3(), vec3(), vec3()]
  for (let k = 0; k < 4; k++) faceDirection(node.face, gridParam(node.ix + (k & 1), cells), gridParam(node.iy + (k >> 1), cells), c[k])
  // Two triangles (0, 1, 3) and (0, 3, 2), as planar areas on the unit sphere.
  const tri = (a: Vec3, b: Vec3, d: Vec3) => {
    const ux = b.x - a.x
    const uy = b.y - a.y
    const uz = b.z - a.z
    const vx = d.x - a.x
    const vy = d.y - a.y
    const vz = d.z - a.z
    return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  }
  return (tri(c[0], c[1], c[3]) + tri(c[0], c[3], c[2])) * radius * radius
}

const centre = vec3()
const probe = vec3()
const neighbour: CubeNode = { face: 0, depth: 0, ix: 0, iy: 0 }

/**
 * Calls `visit` once for every node at `depth` that comes within `angle` radians of unit direction
 * `dir`, with a lower bound on its angular distance (0 for the node containing `dir`). A few nodes
 * just beyond `angle` may be visited too; none within it is ever missed.
 */
export function nodesWithin(dir: Vec3, angle: number, depth: number, visit: (node: CubeNode, distance: number) => void): void {
  const cells = 2 ** depth
  const seen = new Set<number>()
  const queue: CubeNode[] = [nodeAt(dir, depth, { face: 0, depth, ix: 0, iy: 0 })]
  seen.add(nodeKey(queue[0].face, depth, queue[0].ix, queue[0].iy))
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head]
    nodeCenter(node, centre)
    const distance = head === 0 ? 0 : Math.max(0, Math.acos(clamp(dot(dir, centre), -1, 1)) - nodeReach(node, centre))
    if (distance > angle) continue
    visit(node, distance)
    // All eight neighbours: the nodes meeting a disk are connected through edges and corners.
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue
        const ni = node.ix + di
        const nj = node.iy + dj
        if (ni >= 0 && ni < cells && nj >= 0 && nj < cells) {
          neighbour.face = node.face
          neighbour.ix = ni
          neighbour.iy = nj
        } else {
          // Across a cube edge: the point where that neighbour's centre would be lies on the next face.
          faceDirection(node.face, gridParam(2 * ni + 1, 2 * cells), gridParam(2 * nj + 1, 2 * cells), probe)
          nodeAt(probe, depth, neighbour)
        }
        const key = nodeKey(neighbour.face, depth, neighbour.ix, neighbour.iy)
        if (seen.has(key)) continue
        seen.add(key)
        queue.push({ face: neighbour.face, depth, ix: neighbour.ix, iy: neighbour.iy })
      }
    }
  }
}
