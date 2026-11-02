import type { GraphicsPreset } from '@/config/graphics'
import { Lighting } from './Lighting'
import { Rocks } from './Rocks'
import { Terrain } from './Terrain'
import { TerrainCollider } from './TerrainCollider'
import { useActiveRegion } from './useActiveRegion'

/** The active region: lighting, terrain, rocks and the terrain collider. Must sit inside <Physics>. */
export function LunarWorld({ preset }: { preset: GraphicsPreset }) {
  const { region, terrain } = useActiveRegion()
  return (
    <>
      <Lighting
        region={region}
        focus={terrain.spawn}
        shadowMapSize={preset.shadowMapSize}
        shadowExtent={preset.shadowExtent}
        followShadowExtent={preset.followShadowExtent}
      />
      <Terrain
        region={region}
        terrain={terrain}
        spacing={preset.terrainSpacing}
        horizonSegments={preset.horizonSegments}
      />
      <Rocks region={region} terrain={terrain} debrisDensity={preset.debrisDensity} />
      <TerrainCollider terrain={terrain} />
    </>
  )
}
