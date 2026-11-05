import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial, type Group } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { getCaveQueries, getPlanet } from '@/game/planet'
import { useCaveStore } from '@/stores/caveStore'
import { playerRuntime } from '@/stores/runtime'
import type { SurfacePaletteDef } from '@/types/content'
import { toChunkPalette } from '../planet/palette'
import { withPlanetShadow } from '../planet/planetShadow'
import { planetTerrainStatus } from '../planet/terrainStatus'
import { withCaveSky } from './caveMaterial'
import { caveRuntime } from './caveRuntime'
import { createCaveStreamer } from './caveStreamer'

/**
 * Caves under the Moon near the astronaut: their rock, to see and to walk on. `palette` is the
 * terrain's, so rock right under the ground matches it. Must sit inside <Physics>.
 */
export function CaveSystem({ palette }: { palette: SurfacePaletteDef }) {
  const { world, rapier } = useRapier()
  const group = useRef<Group>(null)
  const material = useMemo(
    () => withCaveSky(withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.97, metalness: 0 }))),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const root = group.current
    if (!root) return
    const streamer = createCaveStreamer({
      planet: getPlanet(),
      queries: getCaveQueries(),
      digsOf: (id) => useCaveStore.getState().digs[id] ?? [],
      group: root,
      material,
      physics: { world, rapier },
      palette: toChunkPalette(palette),
    })
    caveRuntime.streamer = streamer
    // New digs: rebuild the rock they touched (a loaded save rebuilds as caves come into range).
    const unsubscribe = useCaveStore.subscribe((now, previous) => {
      for (const [id, list] of Object.entries(now.digs)) {
        const before = previous.digs[id]?.length ?? 0
        if (list.length <= before) continue
        for (let i = before; i + 3 < list.length; i += 4) streamer.dug(id, list[i], list[i + 1], list[i + 2], list[i + 3])
      }
    })
    return () => {
      unsubscribe()
      streamer.dispose()
      if (caveRuntime.streamer === streamer) caveRuntime.streamer = null
    }
  }, [world, rapier, material, palette])

  // After the camera has moved this frame.
  useFrame(({ camera }) => {
    const s = caveRuntime.streamer
    if (!s) return
    s.update(playerRuntime.active ? playerRuntime.position : camera.position)
    planetTerrainStatus.caveBlocks = s.stats.blocks
    planetTerrainStatus.caveQueued = s.stats.queued
  }, FRAME_PRIORITY.followers)

  return <group ref={group} />
}
