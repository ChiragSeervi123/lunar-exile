import type { Rarity } from '@/types/content'

/** Rarities from most to least common, with their display label and accent colour. */
export const RARITIES: Record<Rarity, { rank: number; label: string; color: string }> = {
  common: { rank: 0, label: 'Common', color: '#aab3c1' },
  uncommon: { rank: 1, label: 'Uncommon', color: '#9fd8b8' },
  rare: { rank: 2, label: 'Rare', color: '#8fc8ff' },
  'very-rare': { rank: 3, label: 'Very rare', color: '#c49bff' },
  'extremely-rare': { rank: 4, label: 'Extremely rare', color: '#ffc46b' },
}
