import { useRapier, type RapierCollider, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { COLLISION } from '@/config/game'
import { isPresent, type Deposit, type DepositSites } from '@/game/mining'
import { useWorldStore } from '@/stores/worldStore'
import { depositColliderShapes, type DepositColliderShape } from './depositColliderShapes'
import { depositTargets } from './depositTargets'

interface Entry {
  shape: DepositColliderShape
  collider: RapierCollider
}

/** Enables each collider while its deposit, or the ore it left, is in the world. */
function sync(byId: ReadonlyMap<string, Entry[]> | undefined, sites: DepositSites): void {
  for (const entries of byId?.values() ?? []) {
    for (const { shape, collider } of entries) {
      const present = isPresent(sites, shape.deposit.id, shape.feature)
      if (collider.isEnabled() !== present) collider.setEnabled(present)
    }
  }
}

/**
 * Two colliders per deposit on one fixed body: the deposit itself (solid like a rock, unless it is
 * a flat patch) and a small box for the ore it leaves, which can only be aimed at. Each is enabled
 * only while it exists in the world, so mined-out deposits can't be aimed at or bumped into. As
 * deposits stream in and out, only the ones that changed get or lose colliders: those already
 * there stay, so standing next to one never leaves a gap (new colliders only count after a step).
 */
export function DepositColliders({ deposits }: { deposits: readonly Deposit[] }) {
  const { world, rapier } = useRapier()
  const state = useRef<{ body: RapierRigidBody; byId: Map<string, Entry[]> } | null>(null)

  // One body for the lifetime of the physics world.
  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    state.current = { body, byId: new Map() }
    const unsubscribe = useWorldStore.subscribe((now, previous) => {
      if (now.sites !== previous.sites) sync(state.current?.byId, now.sites)
    })
    return () => {
      unsubscribe()
      for (const entries of state.current?.byId.values() ?? []) for (const { collider } of entries) depositTargets.delete(collider.handle)
      state.current = null
      // <Physics> cleans up first and may already have freed the world; only remove our own body.
      if (world.getRigidBody(body.handle) === body) world.removeRigidBody(body)
    }
  }, [world, rapier])

  // Colliders for deposits that arrived; none for those that left.
  useEffect(() => {
    const s = state.current
    if (!s) return
    const wanted = new Map(deposits.map((d) => [d.id, d]))
    for (const [id, entries] of s.byId) {
      if (wanted.has(id)) continue
      for (const { collider } of entries) {
        depositTargets.delete(collider.handle)
        if (world.getCollider(collider.handle) === collider) world.removeCollider(collider, false)
      }
      s.byId.delete(id)
    }
    const arrived = deposits.filter((d) => !s.byId.has(d.id))
    for (const shape of depositColliderShapes(arrived)) {
      const [hx, hy, hz] = shape.halfExtents
      const [tx, ty, tz] = shape.translation
      const [qx, qy, qz, qw] = shape.rotation
      const desc = rapier.ColliderDesc.roundCuboid(hx, hy, hz, shape.borderRadius)
        .setTranslation(tx, ty, tz)
        .setRotation({ x: qx, y: qy, z: qz, w: qw })
        .setCollisionGroups(shape.solid ? COLLISION.deposit : COLLISION.flatDeposit)
      const collider = world.createCollider(desc, s.body)
      depositTargets.set(collider.handle, { deposit: shape.deposit, kind: shape.feature })
      let entries = s.byId.get(shape.deposit.id)
      if (!entries) s.byId.set(shape.deposit.id, (entries = []))
      entries.push({ shape, collider })
    }
    sync(s.byId, useWorldStore.getState().sites)
  }, [world, rapier, deposits])

  return null
}
