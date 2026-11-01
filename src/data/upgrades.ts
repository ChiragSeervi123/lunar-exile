import type { UpgradeDef } from '@/types/content'

export const UPGRADES = {
  'oxygen-tank': {
    name: 'Oxygen Tank',
    description: 'Increases maximum oxygen.',
    stat: 'maxOxygen',
    maxLevel: 3,
    costs: [100, 250, 600],
    perLevel: 25,
  },
} satisfies Record<string, UpgradeDef>

export type UpgradeId = keyof typeof UPGRADES
