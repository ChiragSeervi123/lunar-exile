import type { MissionDef } from '@/types/content'

export const MISSIONS = {
  'first-steps': {
    title: 'First Steps',
    description: 'Gather regolith to repair your lander.',
    objectives: [{ type: 'collect', itemId: 'regolith', amount: 10 }],
    rewards: { credits: 100 },
  },
} satisfies Record<string, MissionDef>

export type MissionId = keyof typeof MISSIONS
