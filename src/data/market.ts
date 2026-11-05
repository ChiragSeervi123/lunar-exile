import type { ItemId } from './items'

/*
 * The lander's trade terminal: what it pays for resources and what it sells, in Lunar Credits
 * (LC, whole numbers). Starting values for play-testing; every economy number lives here.
 * Oxygen tanks, suits and weapons join the shop with the systems that give them a use (M6, M7).
 */

/** LC paid per unit. Every item is listed; null means the terminal won't buy it. */
export const SELL_PRICES = {
  'lunar-dust': 1,
  regolith: 2,
  titanium: 6,
  helium3: 25,
  'alien-crystal': 80,
  'ancient-component': 300,
  // Survival supplies are kept, not traded.
  'oxygen-canister': null,
} as const satisfies Record<ItemId, number | null>

export type ShopCategory = 'tools' | 'storage' | 'equipment'

export const SHOP_CATEGORIES: readonly { id: ShopCategory; label: string }[] = [
  { id: 'tools', label: 'Mining tools' },
  { id: 'storage', label: 'Storage' },
  { id: 'equipment', label: 'Equipment' },
]

/** Upgrades and what each level does. Level 0 is the starting gear. */
export const UPGRADE_EFFECTS = {
  /** Backpack: how many times each item's base stack limit can be carried. */
  'cargo-pack': { name: 'Cargo Pack', levels: [1, 1.5, 2, 3], unit: '× capacity' },
  /** Helmet lamp: brightness and reach, as multiples of the standard lamp's. */
  'helmet-lamp': { name: 'Helmet Lamp', levels: [1, 1.35, 1.7], unit: '× brightness and reach' },
} as const

export type UpgradeEffectId = keyof typeof UPGRADE_EFFECTS

export interface ShopOffer {
  id: string
  category: ShopCategory
  name: string
  description: string
  /** What buying it does in play, shown in the shop. */
  effect: string
  kind: 'tool' | 'upgrade'
  /** Tool id (data/tools.ts) or upgrade id (UPGRADE_EFFECTS). */
  grants: string
  /** LC per purchase: one for a tool, one per level for an upgrade. */
  prices: readonly number[]
  /** Offers to buy first. */
  requires?: readonly string[]
}

export const SHOP_OFFERS: readonly ShopOffer[] = [
  {
    id: 'pulse-cutter',
    category: 'tools',
    name: 'Pulse Cutter',
    description: 'A pulsed beam that fractures rock along its grain.',
    effect: 'Mines and digs 60% faster than the standard beam; reach 5 m.',
    kind: 'tool',
    grants: 'pulse-cutter',
    prices: [350],
  },
  {
    id: 'plasma-lance',
    category: 'tools',
    name: 'Plasma Lance',
    description: 'A focused plasma jet that cuts even alien crystal cleanly.',
    effect: 'Mines and digs 2.6× as fast as the standard beam; reach 5.5 m.',
    kind: 'tool',
    grants: 'plasma-lance',
    prices: [1500],
    requires: ['pulse-cutter'],
  },
  {
    id: 'cargo-pack',
    category: 'storage',
    name: 'Cargo Pack',
    description: 'Extra pressurised cargo pods for the backpack frame.',
    effect: 'Carry 1.5×, then 2×, then 3× as much of every resource.',
    kind: 'upgrade',
    grants: 'cargo-pack',
    prices: [200, 600, 1500],
  },
  {
    id: 'helmet-lamp',
    category: 'equipment',
    name: 'Helmet Lamp',
    description: 'Brighter emitters for the helmet lamp.',
    effect: 'A brighter lamp that reaches farther, in caves and at night.',
    kind: 'upgrade',
    grants: 'helmet-lamp',
    prices: [150, 450],
  },
]

/** The level-dependent value of an upgrade's effect (level 0 is the starting gear). */
export function upgradeEffect(id: UpgradeEffectId, level: number): number {
  const levels = UPGRADE_EFFECTS[id].levels
  return levels[Math.max(0, Math.min(levels.length - 1, Math.floor(level) || 0))]
}
