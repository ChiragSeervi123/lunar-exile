import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { PHYSICS } from '@/config/game'
import { useGameStore } from '@/stores/gameStore'
import { CameraRig } from '@/scene/camera/CameraRig'
import { SpaceBackdrop } from '@/scene/effects/SpaceBackdrop'
import { LunarWorld } from '@/scene/world/LunarWorld'

/** The 3D scene root: renderer, physics, and top-level scene composition. */
export function GameCanvas() {
  const paused = useGameStore((s) => s.phase === 'paused')
  return (
    <Canvas camera={{ position: [0, 1.7, 5], fov: 75 }} shadows>
      <SpaceBackdrop />
      <CameraRig />
      <Physics gravity={PHYSICS.gravity} paused={paused}>
        <LunarWorld />
      </Physics>
    </Canvas>
  )
}
