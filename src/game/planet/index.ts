import { MOON } from '@/data/moon'
import { getRegion } from '@/data/regions'
import { getRegionDeposits, type RegionDeposits } from '@/game/mining'
import { placeLandingDeposits } from './deposits'
import { createPlanet, type Planet } from './sampler'

export * from './cells'
export * from './craters'
export * from './cubeSphere'
export * from './deposits'
export * from './frame'
export * from './provinces'
export * from './rocks'
export * from './sampler'
export * from './selenographic'

let moon: Planet | null = null
let landingDeposits: RegionDeposits | null = null

/** The Moon, created once and shared by rendering, physics and gameplay. */
export function getPlanet(): Planet {
  moon ??= createPlanet(MOON, getRegion(MOON.landingRegion), MOON.landingRegion)
  return moon
}

/** The landing site's deposits on the Moon (world space, Milestone 3 ids), created once. */
export function getLandingDeposits(): RegionDeposits {
  landingDeposits ??= placeLandingDeposits(getPlanet(), getRegionDeposits(MOON.landingRegion))
  return landingDeposits
}
