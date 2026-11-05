import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, type Group } from 'three'
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

  // Compile the rock's shader now, with the scene's lights, instead of when the first block comes
  // into view: that stalled one frame by about 0.1 s on the way to the first cave of a session.
  // Synchronous `compile`, once: `compileAsync` polls the program on a timer, and a poll landing
  // after the program was replaced queried a deleted program (a WebGL error).
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(9), 3))
    geometry.setAttribute('sky', new BufferAttribute(new Float32Array(3), 1))
    const probe = new Mesh(geometry, material)
    probe.castShadow = true
    probe.receiveShadow = true
    gl.compile(probe, camera, scene)
    geometry.dispose()
  }, [gl, scene, camera, material])

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
