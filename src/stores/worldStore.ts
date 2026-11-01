import { create } from 'zustand'
import type { EnemyInstance } from '@/game/ai'
import type { ResourceNode } from '@/game/mining'
import { STARTING_REGION } from '@/data/player'

interface WorldState {
  regionId: string
  resourceNodes: ResourceNode[]
  enemies: EnemyInstance[]
  setRegion: (regionId: string) => void
}

export const useWorldStore = create<WorldState>((set) => ({
  regionId: STARTING_REGION,
  resourceNodes: [],
  enemies: [],
  setRegion: (regionId) => set({ regionId, resourceNodes: [], enemies: [] }),
}))
