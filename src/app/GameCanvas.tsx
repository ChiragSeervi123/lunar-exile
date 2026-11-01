import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useRef } from 'react'
import { PHYSICS } from '@/config/game'
import { GRAPHICS_PRESETS } from '@/config/graphics'
import { CameraRig } from '@/scene/camera/CameraRig'
import { Sky } from '@/scene/sky/Sky'
import { LunarWorld } from '@/scene/world/LunarWorld'
import { useActiveRegion } from '@/scene/world/useActiveRegion'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'

/** The 3D scene root: renderer, physics, and top-level scene composition. Stays mounted across menu and game. */
export function GameCanvas() {
  const quality = useSettingsStore((s) => s.graphicsQuality)
  const preset = GRAPHICS_PRESETS[quality]
  const paused = useGameStore((s) => s.phase !== 'playing')
  const { region, terrain } = useActiveRegion()

  return (
    <Canvas
      shadows="percentage"
      dpr={preset.dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <CameraRig region={region} terrain={terrain} />
      <Sky region={region} starCount={preset.starCount} />
      <Suspense fallback={null}>
        <Physics gravity={PHYSICS.gravity} paused={paused}>
          <LunarWorld preset={preset} />
        </Physics>
        <SceneReadySignal />
      </Suspense>
    </Canvas>
  )
}

/** Reports readiness once the world has rendered a couple of frames, so the loading cover can lift. */
function SceneReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
    if (frames.current === 3) useGameStore.getState().markSceneReady()
  })
  return null
}
