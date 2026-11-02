import { nodeKey, nodeSize, type CubeNode } from '@/game/planet'
import type { Vec3 } from '@/utils/vec3'
import type { ChunkWish } from './chunkBuilder'

/** Where a built chunk is: a bounding sphere in world space, and how high its ground reaches. */
export interface ChunkBounds {
  center: Vec3
  radius: number
  /** Distance from the Moon's centre to the chunk's highest ground. */
  top: number
}

export interface LodOptions {
  /** Planet radius and the lowest ground below it (the horizon is judged against that). */
  radius: number
  minHeight: number
  maxDepth: number
  /** A chunk splits once the camera is within this many chunk sizes of it. */
  split: number
}

export interface LodSelection {
  /** Chunks to draw: they cover everything the camera can see, once, without overlapping. */
  display: number[]
  /** Chunks to build, with priorities (distance in meters). */
  wanted: ChunkWish[]
  /** Every chunk looked at this frame (so it isn't evicted). */
  visited: number[]
}

export function createLodSelection(): LodSelection {
  return { display: [], wanted: [], visited: [] }
}

/**
 * Picks the chunks to draw from the camera position. A chunk is replaced by its four children only
 * when all four are built, so nothing is ever missing while finer detail streams in; until then
 * the missing children are requested and the parent stays. Chunks behind the Moon's horizon are
 * skipped entirely.
 */
export function selectLod(
  camera: Vec3,
  boundsOf: (key: number) => ChunkBounds | undefined,
  options: LodOptions,
  out: LodSelection,
): LodSelection {
  out.display.length = 0
  out.wanted.length = 0
  out.visited.length = 0
  const { radius, maxDepth, split } = options
  const occluder = radius + options.minHeight
  const camDist = Math.hypot(camera.x, camera.y, camera.z)
  // Angle (seen from the centre) between straight below the camera and its horizon on the occluder.
  const camHorizon = camDist > occluder ? Math.acos(occluder / camDist) : 0

  // Hidden when the chunk lies wholly beyond the horizon of a sphere just inside the lowest ground,
  // even counting its highest point (mountains rise into view from farther away).
  const hidden = (b: ChunkBounds) => {
    if (camDist <= occluder) return false
    const c = Math.hypot(b.center.x, b.center.y, b.center.z)
    const nodeHorizon = b.top > occluder ? Math.acos(occluder / b.top) : 0
    const cosAngle = (camera.x * b.center.x + camera.y * b.center.y + camera.z * b.center.z) / (camDist * c)
    const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)))
    const spread = Math.asin(Math.min(1, b.radius / c))
    return angle - spread > camHorizon + nodeHorizon
  }

  const visit = (face: number, depth: number, ix: number, iy: number) => {
    const key = nodeKey(face, depth, ix, iy)
    const bounds = boundsOf(key)
    if (!bounds) {
      // Only roots can be unbuilt here: a parent splits only once all its children exist.
      out.wanted.push({ key, node: { face, depth, ix, iy }, priority: 0 })
      return
    }
    out.visited.push(key)
    if (hidden(bounds)) return
    const distance = Math.max(
      0,
      Math.hypot(camera.x - bounds.center.x, camera.y - bounds.center.y, camera.z - bounds.center.z) - bounds.radius,
    )
    if (depth < maxDepth && distance < split * nodeSize(radius, depth)) {
      let ready = 0
      for (let c = 0; c < 4; c++) {
        const cx = ix * 2 + (c & 1)
        const cy = iy * 2 + (c >> 1)
        const childKey = nodeKey(face, depth + 1, cx, cy)
        if (boundsOf(childKey)) {
          ready++
          // Keep it while its siblings are still on the way.
          out.visited.push(childKey)
        } else out.wanted.push({ key: childKey, node: { face, depth: depth + 1, ix: cx, iy: cy } satisfies CubeNode, priority: distance })
      }
      if (ready === 4) {
        for (let c = 0; c < 4; c++) visit(face, depth + 1, ix * 2 + (c & 1), iy * 2 + (c >> 1))
        return
      }
    }
    out.display.push(key)
  }

  for (let face = 0; face < 6; face++) visit(face, 0, 0, 0)
  out.wanted.sort((a, b) => a.priority - b.priority)
  return out
}
