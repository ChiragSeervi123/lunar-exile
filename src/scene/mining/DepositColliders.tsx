import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import { COLLISION } from '@/config/game'
import { isPresent, type Deposit, type DepositSites } from '@/game/mining'
import { useWorldStore } from '@/stores/worldStore'
import { depositColliderShapes } from './depositColliderShapes'
import { depositTargets } from './depositTargets'

/**
 * Two colliders per deposit on one fixed body: the deposit itself (solid like a rock, unless it is
 * a flat patch) and a small box for the ore it leaves, which can only be aimed at. Each is enabled
 * only while it exists in the world, so mined-out deposits can't be aimed at or bumped into.
 */
export function DepositColliders({ deposits }: { deposits: readonly Deposit[] }) {
  const { world, rapier } = useRapier()
  const shapes = useMemo(() => depositColliderShapes(deposits), [deposits])

  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    const colliders = shapes.map((shape) => {
      const [hx, hy, hz] = shape.halfExtents
      const [tx, ty, tz] = shape.translation
      const [qx, qy, qz, qw] = shape.rotation
      const desc = rapier.ColliderDesc.roundCuboid(hx, hy, hz, shape.borderRadius)
        .setTranslation(tx, ty, tz)
        .setRotation({ x: qx, y: qy, z: qz, w: qw })
        .setCollisionGroups(shape.solid ? COLLISION.deposit : COLLISION.flatDeposit)
      const collider = world.createCollider(desc, body)
      depositTargets.set(collider.handle, { deposit: shape.deposit, kind: shape.feature })
      return { shape, collider }
    })

    const sync = (sites: DepositSites) => {
      for (const { shape, collider } of colliders) {
        const present = isPresent(sites, shape.deposit.id, shape.feature)
        if (collider.isEnabled() !== present) collider.setEnabled(present)
      }
    }
    sync(useWorldStore.getState().sites)
    const unsubscribe = useWorldStore.subscribe((state, previous) => {
      if (state.sites !== previous.sites) sync(state.sites)
    })

    return () => {
      unsubscribe()
      for (const { collider } of colliders) depositTargets.delete(collider.handle)
      // <Physics> cleans up first and may already have freed the world; only remove our own body.
      if (world.getRigidBody(body.handle) === body) world.removeRigidBody(body)
    }
  }, [world, rapier, shapes])

  return null
}
