import { useFrame } from '@react-three/fiber'
import type { GraphicsPreset } from '@/config/graphics'
import { FRAME_PRIORITY } from '@/config/game'
import { getRegion } from '@/data/regions'
import { MOON } from '@/data/moon'
import { getPlanet, type Planet } from '@/game/planet'
import { Lighting } from '../world/Lighting'
import { updatePlanetShadow } from './planetShadow'
import { PlanetRocks } from './PlanetRocks'
import { PlanetTerrain } from './PlanetTerrain'

/** Radius of the sphere that casts the Moon's own shadow, below the mean ground so peaks catch the light last. */
const OCCLUDER_DEPTH = 10

/** The whole Moon: streamed terrain and rocks, and the lighting over them. Must sit inside <Physics>. */
export function PlanetWorld({ preset }: { preset: GraphicsPreset }) {
  const region = getRegion(MOON.landingRegion)
  const planet = getPlanet()
  return (
    <>
      <Lighting
        region={region}
        planet={planet}
        shadowMapSize={preset.shadowMapSize}
        shadowExtent={preset.shadowExtent}
        followShadowExtent={preset.followShadowExtent}
      />
      <PlanetTerrain planet={planet} palette={region.palette} depth={preset.terrainDepth} split={preset.terrainSplit} />
      <PlanetRocks planet={planet} region={region} debrisDensity={preset.debrisDensity} />
      <PlanetShadowUpdater planet={planet} />
    </>
  )
}

function PlanetShadowUpdater({ planet }: { planet: Planet }) {
  // After the camera has moved this frame.
  useFrame(({ camera }) => updatePlanetShadow(camera, planet.radius - OCCLUDER_DEPTH), FRAME_PRIORITY.followers)
  return null
}
