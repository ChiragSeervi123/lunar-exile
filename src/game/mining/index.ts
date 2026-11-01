import { getRegion } from '@/data/regions'
import { getRegionTerrain } from '@/game/world'
import { scatterDeposits, type Deposit } from './deposits'

export * from './deposits'
export * from './extraction'
export * from './sites'

export interface RegionDeposits {
  list: readonly Deposit[]
  byId: ReadonlyMap<string, Deposit>
}

const regions = new Map<string, RegionDeposits>()

/** A region's deposits, generated once and shared by rendering, mining and saving. */
export function getRegionDeposits(regionId: string): RegionDeposits {
  let deposits = regions.get(regionId)
  if (!deposits) {
    const list = scatterDeposits(regionId, getRegion(regionId), getRegionTerrain(regionId))
    deposits = { list, byId: new Map(list.map((deposit) => [deposit.id, deposit])) }
    regions.set(regionId, deposits)
  }
  return deposits
}
