import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { RegionDef } from '@/types/content'

interface TerrainProps {
  region: RegionDef
}

/** Placeholder flat ground sized from the region; replace with heightfield terrain. */
export function Terrain({ region }: TerrainProps) {
  const half = region.size / 2
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[half, 0.5, half]} position={[0, -0.5, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[region.size, region.size]} />
        <meshStandardMaterial color="#6b6e75" />
      </mesh>
    </RigidBody>
  )
}
