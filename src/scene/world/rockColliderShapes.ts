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
const SOLID_CLASSES: readonly RockClass[] = ['medium', 'boulder']
/** Colliders fill this fraction of a rock's bounding box, so contact sits on its rounded surface. */
const FIT = 0.82
/** Rounding radius as a fraction of the smallest half extent. */
const ROUNDING = 0.4

/** Rounded boxes fitted to each solid rock's shape, placement and orientation. */
export function rockColliderShapes(field: RockField, shapes: Record<RockClass, BufferGeometry[]>): RockColliderShape[] {
  const colliders: RockColliderShape[] = []
  const half = new Vector3()
  const center = new Vector3()
  const scale = new Vector3()
  const rotation = new Quaternion()
  const euler = new Euler()

  for (const cls of SOLID_CLASSES) {
    const bounds = shapes[cls].map((geometry) => {
      geometry.computeBoundingBox()
      return geometry.boundingBox?.clone() ?? new Box3()
    })
    for (const rock of field[cls]) {
      const box = bounds[rock.variant]
      scale.set(rock.sx, rock.sy, rock.sz)
      box.getSize(half).multiply(scale).multiplyScalar(FIT / 2)
      rotation.setFromEuler(euler.set(rock.pitch, rock.yaw, rock.roll, 'XZY'))
      box.getCenter(center).multiply(scale).applyQuaternion(rotation)
      const border = Math.min(half.x, half.y, half.z) * ROUNDING
      colliders.push({
        halfExtents: [Math.max(half.x - border, 0.01), Math.max(half.y - border, 0.01), Math.max(half.z - border, 0.01)],
        borderRadius: border,
        translation: [rock.x + center.x, rock.y + center.y, rock.z + center.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      })
    }
  }
  return colliders
}
