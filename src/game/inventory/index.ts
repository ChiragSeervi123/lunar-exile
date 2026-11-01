import { getItem } from '@/data/items'
import { STARTING_TOOL } from '@/data/player'
import { getTool } from '@/data/tools'

/*
 * Backpack rules, free of UI and storage. The backpack holds one stack per item, and a stack holds
 * up to its item's stackSize (data/items.ts). Every operation returns new arrays, never mutating.
 */

export interface InventoryStack {
  itemId: string
  quantity: number
}

export type EquipmentSlot = 'suit' | 'tool' | 'weapon' | 'backpack'

export type Equipment = Partial<Record<EquipmentSlot, string>>

const SLOTS: readonly EquipmentSlot[] = ['suit', 'tool', 'weapon', 'backpack']

/** Quantities are whole numbers above zero. */
export function isValidQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity) && quantity > 0
}

/** Units of an item carried. */
export function countItem(stacks: readonly InventoryStack[], itemId: string): number {
  return stacks.find((stack) => stack.itemId === itemId)?.quantity ?? 0
}

/** Units of an item that still fit; 0 for unknown items. */
export function spaceFor(stacks: readonly InventoryStack[], itemId: string): number {
  const item = getItem(itemId)
  return item ? Math.max(0, item.stackSize - countItem(stacks, itemId)) : 0
}

export function hasItem(stacks: readonly InventoryStack[], itemId: string, quantity: number): boolean {
  return isValidQuantity(quantity) && countItem(stacks, itemId) >= quantity
}

/**
 * Adds as many of `quantity` units as fit under the item's stack limit. Unknown items and invalid
 * quantities add nothing; `stacks` comes back unchanged whenever nothing was added.
 */
export function addItem(
  stacks: readonly InventoryStack[],
  itemId: string,
  quantity: number,
): { stacks: readonly InventoryStack[]; added: number } {
  if (!isValidQuantity(quantity)) return { stacks, added: 0 }
  const added = Math.min(quantity, spaceFor(stacks, itemId))
  if (added === 0) return { stacks, added: 0 }
  const index = stacks.findIndex((stack) => stack.itemId === itemId)
  if (index === -1) return { stacks: [...stacks, { itemId, quantity: added }], added }
  return {
    stacks: stacks.map((stack, i) => (i === index ? { itemId, quantity: stack.quantity + added } : stack)),
    added,
  }
}

/** Removes exactly `quantity` units, or nothing at all if fewer are carried or the quantity is invalid. */
export function removeItem(
  stacks: readonly InventoryStack[],
  itemId: string,
  quantity: number,
): { stacks: readonly InventoryStack[]; removed: boolean } {
  if (!hasItem(stacks, itemId, quantity)) return { stacks, removed: false }
  const next = stacks
    .map((stack) => (stack.itemId === itemId ? { itemId, quantity: stack.quantity - quantity } : stack))
    .filter((stack) => stack.quantity > 0)
  return { stacks: next, removed: true }
}

/**
 * Stacks from untrusted data, such as an old or hand-edited save: unknown items and bad quantities
 * are dropped, duplicates merged, and each stack capped at its limit.
 */
export function sanitizeStacks(raw: unknown): InventoryStack[] {
  if (!Array.isArray(raw)) return []
  let stacks: readonly InventoryStack[] = []
  for (const entry of raw as unknown[]) {
    const { itemId, quantity } = (entry ?? {}) as Partial<InventoryStack>
    if (typeof itemId !== 'string' || typeof quantity !== 'number') continue
    stacks = addItem(stacks, itemId, Math.floor(quantity)).stacks
  }
  return [...stacks]
}

/** Equipment from untrusted data. The astronaut always carries a mining tool it knows how to use. */
export function sanitizeEquipment(raw: unknown): Equipment {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const equipment: Equipment = {}
  for (const slot of SLOTS) {
    const id = source[slot]
    if (typeof id === 'string' && id.length > 0) equipment[slot] = id
  }
  if (!getTool(equipment.tool)) equipment.tool = STARTING_TOOL
  return equipment
}
