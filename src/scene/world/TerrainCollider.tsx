import { HeightfieldCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import { PHYSICS } from '@/config/game'
import { buildHeightfield, type Terrain } from '@/game/world'

/** Static heightfield over the playable area, ready for the player and other bodies. */
export function TerrainCollider({ terrain }: { terrain: Terrain }) {
  const field = useMemo(() => buildHeightfield(terrain, PHYSICS.terrainColliderSpacing), [terrain])
  return (
    <RigidBody type="fixed" colliders={false}>
      <HeightfieldCollider
        args={[field.rows, field.cols, field.heights, { x: field.sizeX, y: 1, z: field.sizeZ }]}
      />
    </RigidBody>
  )
}
