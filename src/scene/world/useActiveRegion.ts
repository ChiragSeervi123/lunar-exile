import { useMemo } from 'react'
import { getRegion } from '@/data/regions'
import { getRegionTerrain, type Terrain } from '@/game/world'
import { useWorldStore } from '@/stores/worldStore'
import type { RegionDef } from '@/types/content'

/** The region the player is in, with its shared terrain. */
export function useActiveRegion(): { region: RegionDef; terrain: Terrain } {
  const regionId = useWorldStore((s) => s.regionId)
  return useMemo(() => ({ region: getRegion(regionId), terrain: getRegionTerrain(regionId) }), [regionId])
}
