import type { ResourceDef } from '@/types/content'

/**
 * Mineable deposit types. Time to mine one = health / (tool power / hardness): with the basic
 * tool roughly 1 s for dust up to 20 s for an ancient structure.
 */
export const RESOURCES = {
  'lunar-dust': {
    name: 'Lunar Dust',
    description: 'A drift of fine regolith, easy to scoop.',
    itemId: 'lunar-dust',
    category: 'mineral',
    rarity: 'common',
    habitat: 'plains',
    health: 30,
    hardness: 1,
    yield: { min: 3, max: 6 },
    respawnSeconds: 300,
    // Paler and warmer than the regolith around it, with bright grains: a fresh drift, not a rock.
    appearance: { shape: 'patch', color: '#ddd6c6', accent: '#fff8ea', roughness: 0.85, size: [0.8, 1.3] },
  },
  'regolith-deposit': {
    name: 'Compressed Regolith',
    description: 'Blocks of regolith packed solid by an old impact.',
    itemId: 'regolith',
    category: 'mineral',
    rarity: 'common',
    habitat: 'crater-rim',
    health: 55,
    hardness: 1.25,
    yield: { min: 3, max: 6 },
    respawnSeconds: 600,
    appearance: { shape: 'blocks', color: '#77726a', accent: '#99938a', roughness: 0.95, size: [0.85, 1.25] },
  },
  'titanium-vein': {
    name: 'Titanium Vein',
    description: 'Metallic shards breaking through dark mare basalt.',
    itemId: 'titanium',
    category: 'metal',
    rarity: 'uncommon',
    habitat: 'mare',
    health: 80,
    hardness: 1.8,
    yield: { min: 2, max: 4 },
    respawnSeconds: 1200,
    appearance: {
      shape: 'vein',
      color: '#cfd5de',
      accent: '#4a4d54',
      metalness: 0.85,
      roughness: 0.3,
      size: [0.85, 1.2],
    },
  },
  'helium3-vein': {
    name: 'Helium-3 Pocket',
    description: 'Pale crystals of frozen volatiles, rich in helium-3, in a cold crater floor.',
    itemId: 'helium3',
    category: 'isotope',
    rarity: 'rare',
    habitat: 'crater-floor',
    health: 90,
    hardness: 2.4,
    yield: { min: 1, max: 3 },
    respawnSeconds: null,
    appearance: {
      shape: 'crystals',
      color: '#c4e6ff',
      accent: '#eef8ff',
      emissive: '#4fb4ff',
      emissiveIntensity: 0.35,
      roughness: 0.35,
      halo: '#4f9dff',
      size: [0.9, 1.2],
    },
  },
  'alien-crystal': {
    name: 'Alien Crystal Cluster',
    description: 'Tall crystals of no known mineral. They should not be here.',
    itemId: 'alien-crystal',
    category: 'crystal',
    rarity: 'very-rare',
    habitat: 'crater-rim',
    health: 120,
    hardness: 2.8,
    yield: { min: 1, max: 2 },
    respawnSeconds: null,
    appearance: {
      shape: 'spires',
      color: '#58ecff',
      accent: '#b46cff',
      emissive: '#7d55ff',
      emissiveIntensity: 0.85,
      roughness: 0.25,
      halo: '#8a5cff',
      size: [0.9, 1.25],
    },
  },
  'ancient-relic': {
    name: 'Ancient Structure',
    description: 'Fragments of a machine, half buried. Something built this.',
    itemId: 'ancient-component',
    category: 'artifact',
    rarity: 'extremely-rare',
    habitat: 'crater-floor',
    health: 150,
    hardness: 3.4,
    yield: { min: 1, max: 1 },
    respawnSeconds: null,
    appearance: {
      shape: 'relic',
      color: '#3c414c',
      accent: '#5bffd6',
      emissive: '#2fe0b8',
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.4,
      halo: '#33f0c0',
      size: [1, 1.15],
    },
  },
} satisfies Record<string, ResourceDef>

export type ResourceId = keyof typeof RESOURCES

export function getResource(id: string): ResourceDef | undefined {
  return (RESOURCES as Record<string, ResourceDef>)[id]
}
