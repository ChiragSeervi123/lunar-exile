import { REGIONS, type RegionId } from '@/data/regions'
import { useWorldStore } from '@/stores/worldStore'
import { Lighting } from './Lighting'
import { Terrain } from './Terrain'

/** Renders the active region. Add resource nodes, enemies, etc. here as they come online. */
export function LunarWorld() {
  const regionId = useWorldStore((s) => s.regionId)
  const region = REGIONS[regionId as RegionId]
  return (
    <>
      <Lighting />
      <Terrain region={region} />
    </>
  )
}
