import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { Color, MeshStandardMaterial, type Group } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { getPlanetRocks, type Planet } from '@/game/planet'
import { playerRuntime } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { createRockSet } from '../world/rockGeometry'
import { withPlanetShadow } from './planetShadow'
import { createRockStreamer, type RockStreamer } from './rockStreamer'
import { planetTerrainStatus } from './terrainStatus'

interface PlanetRocksProps {
  planet: Planet
  region: RegionDef
  debrisDensity: number
}

/** Rocks across the Moon, streamed around the camera, solid around the player. Must sit inside <Physics>. */
export function PlanetRocks({ planet, region, debrisDensity }: PlanetRocksProps) {
  const { world, rapier } = useRapier()
  const group = useRef<Group>(null)
  const streamer = useRef<RockStreamer | null>(null)
  const geometries = useMemo(() => createRockSet(region), [region])
  const material = useMemo(
    () => withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 })),
    [],
  )
  useEffect(
    () => () => {
      material.dispose()
      Object.values(geometries).forEach((variants) => variants.forEach((geometry) => geometry.dispose()))
    },
    [material, geometries],
  )

  useEffect(() => {
    const root = group.current
    if (!root) return
    const s = createRockStreamer({
      planet,
      field: getPlanetRocks(),
      debrisDensity,
      geometries,
      material,
      tint: new Color(region.palette.rock),
      group: root,
      physics: { world, rapier },
    })
    streamer.current = s
    return () => {
      s.dispose()
      streamer.current = null
    }
  }, [planet, region, debrisDensity, geometries, material, world, rapier])

  // After the camera has moved this frame.
  useFrame(({ camera }) => {
    const s = streamer.current
    if (!s) return
    s.update(camera.position, playerRuntime.active ? playerRuntime.position : null)
    planetTerrainStatus.rocks = s.stats.drawn.debris + s.stats.drawn.medium + s.stats.drawn.boulder
    planetTerrainStatus.rockColliders = s.stats.colliders
  }, FRAME_PRIORITY.followers)

  return <group ref={group} />
}
