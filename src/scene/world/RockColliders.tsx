import { useRapier } from '@react-three/rapier'
import { useEffect } from 'react'
import { COLLISION } from '@/config/game'
import type { RockColliderShape } from './rockColliderShapes'

/** All solid rocks as colliders on one fixed body, so they cost a single rigid body. */
export function RockColliders({ shapes }: { shapes: RockColliderShape[] }) {
  const { world, rapier } = useRapier()

  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    for (const shape of shapes) {
      const [hx, hy, hz] = shape.halfExtents
      const [tx, ty, tz] = shape.translation
      const [qx, qy, qz, qw] = shape.rotation
      const desc = rapier.ColliderDesc.roundCuboid(hx, hy, hz, shape.borderRadius)
        .setTranslation(tx, ty, tz)
        .setRotation({ x: qx, y: qy, z: qz, w: qw })
        .setCollisionGroups(COLLISION.obstacles)
      world.createCollider(desc, body)
    }
    return () => {
      // <Physics> cleans up first and may already have freed the world; only remove our own body.
      if (world.getRigidBody(body.handle) === body) world.removeRigidBody(body)
    }
  }, [world, rapier, shapes])

  return null
}
