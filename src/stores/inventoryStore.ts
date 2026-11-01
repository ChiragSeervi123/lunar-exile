import { create } from 'zustand'
import type { Equipment, InventoryStack } from '@/game/inventory'

interface InventoryState {
  stacks: InventoryStack[]
  equipment: Equipment
}

export const useInventoryStore = create<InventoryState>(() => ({
  stacks: [],
  equipment: {},
}))
