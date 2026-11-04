import { Box3, Euler, Quaternion, Vector3, type BufferGeometry } from 'three'
import type { RockClass, RockField } from '@/game/world'

export interface RockColliderShape {
  /** Half extents of the box inside the rounding, meters. */
  halfExtents: [number, number, number]
  borderRadius: number
  translation: [number, number, number]
  /** Quaternion (x, y, z, w). */
  rotation: [number, number, number, number]
}

/** Rocks the player can't walk through. Debris is decorative, and its amount follows graphics quality. */
export const SOLID_ROCK_CLASSES: readonly RockClass[] = ['medium', 'boulder']
/** Colliders fill this fraction of a rock's bounding box, so contact sits on its rounded surface. */
const FIT = 0.82
/** Rounding radius as a fraction of the smallest half extent. */
const ROUNDING = 0.4

/** Bounding boxes of every rock shape, per class and variant. */
export function rockShapeBounds(shapes: Record<RockClass, BufferGeometry[]>): Record<RockClass, Box3[]> {
  const bounds = {} as Record<RockClass, Box3[]>
  for (const cls of Object.keys(shapes) as RockClass[]) {
    bounds[cls] = shapes[cls].map((geometry) => {
      geometry.computeBoundingBox()
      return geometry.boundingBox?.clone() ?? new Box3()
    })
  }
  return bounds
}

const half = new Vector3()
const center = new Vector3()
const scale = new Vector3()

/** A rounded box fitted to one rock: its shape's bounds `box`, scaled, rotated and placed. */
export function fitRockCollider(
  box: Box3,
  x: number,
  y: number,
  z: number,
  rotation: Quaternion,
  sx: number,
  sy: number,
  sz: number,
): RockColliderShape {
  scale.set(sx, sy, sz)
  box.getSize(half).multiply(scale).multiplyScalar(FIT / 2)
  box.getCenter(center).multiply(scale).applyQuaternion(rotation)
  const border = Math.min(half.x, half.y, half.z) * ROUNDING
  return {
    halfExtents: [Math.max(half.x - border, 0.01), Math.max(half.y - border, 0.01), Math.max(half.z - border, 0.01)],
    borderRadius: border,
    translation: [x + center.x, y + center.y, z + center.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
  }
}

/** Rounded boxes fitted to each solid rock's shape, placement and orientation. */
export function rockColliderShapes(field: RockField, shapes: Record<RockClass, BufferGeometry[]>): RockColliderShape[] {
  const colliders: RockColliderShape[] = []
  const bounds = rockShapeBounds(shapes)
  const rotation = new Quaternion()
  const euler = new Euler()
  for (const cls of SOLID_ROCK_CLASSES) {
    for (const rock of field[cls]) {
      rotation.setFromEuler(euler.set(rock.pitch, rock.yaw, rock.roll, 'XZY'))
      colliders.push(fitRockCollider(bounds[cls][rock.variant], rock.x, rock.y, rock.z, rotation, rock.sx, rock.sy, rock.sz))
    }
  }
  return colliders
}
