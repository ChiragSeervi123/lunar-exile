import type { ItemDef } from '@/types/content'

export const ITEMS = {
  regolith: { name: 'Lunar Regolith', kind: 'resource', stackSize: 100, value: 2 },
  helium3: { name: 'Helium-3', kind: 'resource', stackSize: 50, value: 40 },
  'oxygen-canister': { name: 'Oxygen Canister', kind: 'consumable', stackSize: 5, value: 60 },
} satisfies Record<string, ItemDef>

export type ItemId = keyof typeof ITEMS
