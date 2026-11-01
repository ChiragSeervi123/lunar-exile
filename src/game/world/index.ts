import { getRegion } from '@/data/regions'
import { createTerrain, type Terrain } from './terrain'

export * from './craters'
export * from './rocks'
export * from './terrain'

const terrains = new Map<string, Terrain>()

/** Terrain for a region, created once and shared by rendering, physics and gameplay. */
export function getRegionTerrain(regionId: string): Terrain {
  let terrain = terrains.get(regionId)
  if (!terrain) {
    terrain = createTerrain(getRegion(regionId))
    terrains.set(regionId, terrain)
  }
  return terrain
}
