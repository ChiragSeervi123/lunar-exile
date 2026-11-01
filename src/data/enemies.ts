import type { EnemyDef } from '@/types/content'

export const ENEMIES = {
  'dust-crawler': {
    name: 'Dust Crawler',
    health: 40,
    speed: 3,
    damage: 8,
    detectionRange: 25,
    attackRange: 2,
    drops: [{ itemId: 'regolith', chance: 0.5, quantity: 2 }],
  },
} satisfies Record<string, EnemyDef>

export type EnemyId = keyof typeof ENEMIES
