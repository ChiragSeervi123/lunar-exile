import type { RegionDef } from '@/types/content'

export const REGIONS = {
  'landing-site': {
    name: 'Landing Site',
    description: 'The crash site and starting area.',
    size: 200,
    terrain: { seed: 1, amplitude: 0, roughness: 0 },
    resourceNodes: [{ resourceId: 'regolith-deposit', density: 0.5 }],
    enemySpawns: [],
  },
} satisfies Record<string, RegionDef>

export type RegionId = keyof typeof REGIONS
