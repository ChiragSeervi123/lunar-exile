import { create } from 'zustand'
import { STARTING_TOOL } from '@/data/player'
import { addItem, removeItem, type Equipment, type InventoryStack } from '@/game/inventory'

interface InventoryState {
  stacks: readonly InventoryStack[]
  equipment: Equipment
  /** Adds what fits under the item's stack limit; returns the units added. */
  addItem: (itemId: string, quantity: number) => number
  /** Removes exactly `quantity` units; false (and nothing removed) if there aren't that many. */
  removeItem: (itemId: string, quantity: number) => boolean
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stacks: [],
  equipment: { tool: STARTING_TOOL },
  addItem: (itemId, quantity) => {
    const result = addItem(get().stacks, itemId, quantity)
    if (result.added > 0) set({ stacks: result.stacks })
    return result.added
  },
  removeItem: (itemId, quantity) => {
    const result = removeItem(get().stacks, itemId, quantity)
    if (result.removed) set({ stacks: result.stacks })
    return result.removed
  },
}))
