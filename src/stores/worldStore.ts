import { create } from 'zustand'
import type { EnemyInstance } from '@/game/ai'
import { breakSite, collectFromSite, emptySites, regrowSites, type DepositSites } from '@/game/mining'
import { STARTING_REGION } from '@/data/player'

interface WorldState {
  regionId: string
  /** Mined-out deposits and the ore they left, in the current region. */
  sites: DepositSites
  enemies: EnemyInstance[]
  setRegion: (regionId: string) => void
  /** A deposit broke, leaving `quantity` units of ore. False if it was already mined out. */
  breakDeposit: (depositId: string, quantity: number, playTime: number) => boolean
  /** Ore picked up from a mined-out deposit. False if there wasn't that much. */
  collectOre: (depositId: string, quantity: number, playTime: number) => boolean
  regrowDeposits: (depositIds: readonly string[]) => void
}

export const useWorldStore = create<WorldState>((set, get) => ({
  regionId: STARTING_REGION,
  sites: emptySites(),
  enemies: [],
  setRegion: (regionId) => set({ regionId, sites: emptySites(), enemies: [] }),
  breakDeposit: (depositId, quantity, playTime) => {
    const sites = breakSite(get().sites, depositId, quantity, playTime)
    if (sites) set({ sites })
    return sites !== null
  },
  collectOre: (depositId, quantity, playTime) => {
    const sites = collectFromSite(get().sites, depositId, quantity, playTime)
    if (sites) set({ sites })
    return sites !== null
  },
  regrowDeposits: (depositIds) => {
    const sites = regrowSites(get().sites, depositIds)
    if (sites !== get().sites) set({ sites })
  },
}))
