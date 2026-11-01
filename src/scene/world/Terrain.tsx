import { useEffect, useMemo } from 'react'
import type { Terrain as TerrainData } from '@/game/world'
import type { RegionDef } from '@/types/content'
import { buildTerrainMeshes } from './terrainGeometry'

interface TerrainProps {
  region: RegionDef
  terrain: TerrainData
  spacing: number
  horizonSegments: number
}

export function Terrain({ region, terrain, spacing, horizonSegments }: TerrainProps) {
  const meshes = useMemo(
    () => buildTerrainMeshes(terrain, region.palette, { spacing, horizonSegments, seed: region.terrain.seed }),
    [terrain, region, spacing, horizonSegments],
  )
  useEffect(
    () => () => {
      meshes.near.dispose()
      meshes.far.dispose()
    },
    [meshes],
  )

  return (
    <>
      <mesh geometry={meshes.near} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.96} metalness={0} />
      </mesh>
      {/* Beyond the shadow-casting area: only receives light. */}
      <mesh geometry={meshes.far} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.96} metalness={0} />
      </mesh>
    </>
  )
}
