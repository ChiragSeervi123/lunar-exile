import { MOON } from '@/data/moon'
import { getRegion } from '@/data/regions'
import { createPlanet, type Planet } from './sampler'

export * from './craters'
export * from './cubeSphere'
export * from './frame'
export * from './provinces'
export * from './sampler'

let moon: Planet | null = null

/** The Moon, created once and shared by rendering, physics and gameplay. */
export function getPlanet(): Planet {
  moon ??= createPlanet(MOON, getRegion(MOON.landingRegion), MOON.landingRegion)
  return moon
}
