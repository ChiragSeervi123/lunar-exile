import { MOON } from '@/data/moon'
import { getRegion } from '@/data/regions'
import { getRegionDeposits, type Deposit, type RegionDeposits } from '@/game/mining'
import { createCaveDeposits } from './caveDeposits'
import { createCaveQueries, type CaveQueries } from './caveQueries'
import { placeLandingDeposits } from './deposits'
import { createPlanetDepositField, type PlanetDepositField } from './planetDeposits'
import { createPlanetRockField, type PlanetRockField } from './rocks'
import { createPlanet, type Planet } from './sampler'
import { createDiscoverySites, type DiscoverySite } from './sites'

export * from './caveDeposits'
export * from './caveQueries'
export * from './caves'
export * from './cells'
export * from './craters'
export * from './cubeSphere'
export * from './deposits'
export * from './frame'
export * from './planetDeposits'
export * from './provinces'
export * from './rocks'
export * from './sampler'
export * from './selenographic'
export * from './sites'

let moon: Planet | null = null
let landingDeposits: RegionDeposits | null = null
let rockField: PlanetRockField | null = null
let depositField: PlanetDepositField | null = null
let sites: readonly DiscoverySite[] | null = null
let caveQueries: CaveQueries | null = null
const caveDeposits = new Map<string, readonly Deposit[]>()

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

/** Rocks across the Moon, shared by drawing, collision and deposit placement. */
export function getPlanetRocks(): PlanetRockField {
  rockField ??= createPlanetRockField(getPlanet(), getRegion(MOON.landingRegion), clearZones())
  return rockField
}

/** Deposits across the Moon (beyond the landing site's own), generated per cell on demand. */
export function getPlanetDeposits(): PlanetDepositField {
  depositField ??= createPlanetDepositField(getPlanet(), getPlanetRocks(), clearZones())
  return depositField
}

/** Every place to discover besides provinces: landmark craters, alien structures, cave entrances. */
export function getDiscoverySites(): readonly DiscoverySite[] {
  sites ??= createDiscoverySites(getPlanet())
  return sites
}

/** Where rocks and deposits are never scattered: around structures and cave mouths. */
function clearZones() {
  return getDiscoverySites()
    .filter((s) => s.clearance > 0)
    .map((s) => ({ dir: s.dir, radius: s.clearance }))
}

/** Questions about the caves (holes in the ground, being underground), shared by everything. */
export function getCaveQueries(): CaveQueries {
  caveQueries ??= createCaveQueries(getPlanet())
  return caveQueries
}

/** The deposits on a cave's floors (deeper means rarer), created once per cave. */
export function getCaveDeposits(caveId: string): readonly Deposit[] {
  let list = caveDeposits.get(caveId)
  if (!list) {
    const cave = getPlanet().caves.find((c) => c.id === caveId)
    list = cave ? createCaveDeposits(getPlanet().seed, cave, getCaveQueries().shape(cave)) : []
    caveDeposits.set(caveId, list)
  }
  return list
}
