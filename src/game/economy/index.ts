import { ECONOMY } from '@/config/game'
import { ITEMS, type ItemId } from '@/data/items'

export function sellPrice(itemId: ItemId, quantity = 1): number {
  return Math.floor(ITEMS[itemId].value * ECONOMY.sellMultiplier) * quantity
}

export function canAfford(credits: number, cost: number): boolean {
  return credits >= cost
}
