import { create } from 'zustand'
import { STARTING_CREDITS } from '@/data/player'

interface EconomyState {
  credits: number
  /** Purchased level per upgrade id. */
  upgradeLevels: Record<string, number>
  ownedShips: string[]
}

export const useEconomyStore = create<EconomyState>(() => ({
  credits: STARTING_CREDITS,
  upgradeLevels: {},
  ownedShips: ['scout-lander'],
}))
