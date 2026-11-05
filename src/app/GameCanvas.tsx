import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useRef } from 'react'
import { FRAME_PRIORITY } from '@/config/game'
import { GRAPHICS_PRESETS } from '@/config/graphics'
import { getRegion } from '@/data/regions'
import { MOON } from '@/data/moon'
import { getPlanet } from '@/game/planet'
import { CameraRig } from '@/scene/camera/CameraRig'
import { CaveSystem } from '@/scene/caves/CaveSystem'
import { ExplorationSystem } from '@/scene/exploration/ExplorationSystem'
import { Structures } from '@/scene/exploration/Structures'
import { Mining } from '@/scene/mining/Mining'
import { planetTerrainStatus } from '@/scene/planet/terrainStatus'
import { PlanetWorld } from '@/scene/planet/PlanetWorld'
import { FirstPersonTool } from '@/scene/player/FirstPersonTool'
import { Player } from '@/scene/player/Player'
import { Sky } from '@/scene/sky/Sky'
import { useGameStore } from '@/stores/gameStore'
import { useSettingsStore } from '@/stores/settingsStore'

/** No global gravity: "down" is toward the Moon's centre, different everywhere, so each body pulls itself. */
const NO_GRAVITY: [number, number, number] = [0, 0, 0]

/** The 3D scene root: renderer, physics, and top-level scene composition. Stays mounted across menu and game. */
export function GameCanvas() {
  const quality = useSettingsStore((s) => s.graphicsQuality)
  const preset = GRAPHICS_PRESETS[quality]
  const phase = useGameStore((s) => s.phase)
  // The landing site's region sets the sky, the palette and the arrival point.
  const region = getRegion(MOON.landingRegion)
  const planet = getPlanet()

  return (
    <Canvas shadows="percentage" dpr={preset.dpr} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <Sky region={region} starCount={preset.starCount} />
      <Suspense fallback={null}>
        {/* Runs behind the menu too (static bodies only, nearly free), so queries are ready when a game starts. */}
        <Physics gravity={NO_GRAVITY} paused={phase === 'paused'} updatePriority={FRAME_PRIORITY.physics}>
          <CameraRig region={region} planet={planet}>
            <FirstPersonTool />
          </CameraRig>
          <PlanetWorld preset={preset} />
          <CaveSystem palette={region.palette} />
          <Mining region={region} particleBudget={preset.particleBudget} />
          {phase !== 'menu' && <Player region={region} planet={planet} />}
          <Structures />
          <ExplorationSystem />
        </Physics>
        <SceneReadySignal />
      </Suspense>
    </Canvas>
  )
}

/** Reports readiness once the Moon in view has its detail and a couple of frames have rendered, so the loading cover can lift. */
function SceneReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    if (!planetTerrainStatus.ready) return
    frames.current += 1
    if (frames.current === 3) useGameStore.getState().markSceneReady()
  })
  return null
}
