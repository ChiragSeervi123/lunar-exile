import type { ItemDef } from '@/types/content'

export const ITEMS = {
  'lunar-dust': {
    name: 'Lunar Dust',
    description: 'Fine grey regolith. Filler and feedstock for nearly everything.',
    kind: 'resource',
    rarity: 'common',
    stackSize: 500,
    value: 1,
    color: '#c2bdb2',
  },
  regolith: {
    name: 'Compressed Regolith',
    description: 'Impact-compacted regolith blocks. Dense and good for building.',
    kind: 'resource',
    rarity: 'common',
    stackSize: 300,
    value: 2,
    color: '#8d877c',
  },
  titanium: {
    name: 'Titanium',
    description: 'Metal refined from ilmenite-rich basalt. Strong and light.',
    kind: 'resource',
    rarity: 'uncommon',
    stackSize: 150,
    value: 8,
    color: '#cdd3db',
  },
  helium3: {
    name: 'Helium-3',
    description: 'Solar-wind isotope trapped in cold crater soil. Prized fusion fuel.',
    kind: 'resource',
    rarity: 'rare',
    stackSize: 80,
    value: 40,
    color: '#8fd0ff',
  },
  'alien-crystal': {
    name: 'Alien Crystal',
    description: 'A lattice of no known mineral. It hums faintly in the hand.',
    kind: 'resource',
    rarity: 'very-rare',
    stackSize: 40,
    value: 120,
    color: '#b98cff',
  },
  'ancient-component': {
    name: 'Ancient Component',
    description: 'A machined fragment far older than the craters around it.',
    kind: 'resource',
    rarity: 'extremely-rare',
    stackSize: 10,
    value: 400,
    color: '#5effd2',
  },
  'oxygen-canister': {
    name: 'Oxygen Canister',
    description: 'Spare breathing gas for the suit.',
    kind: 'consumable',
    rarity: 'common',
    stackSize: 5,
    value: 60,
    color: '#86d6e0',
  },
} satisfies Record<string, ItemDef>

export type ItemId = keyof typeof ITEMS

export function getItem(id: string): ItemDef | undefined {
  return (ITEMS as Record<string, ItemDef>)[id]
}
