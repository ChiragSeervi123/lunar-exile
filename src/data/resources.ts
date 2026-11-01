import type { ResourceDef } from '@/types/content'

export const RESOURCES = {
  'regolith-deposit': {
    name: 'Regolith Deposit',
    itemId: 'regolith',
    hardness: 1,
    yield: { min: 3, max: 6 },
  },
  'helium3-vein': {
    name: 'Helium-3 Vein',
    itemId: 'helium3',
    hardness: 3,
    yield: { min: 1, max: 3 },
  },
} satisfies Record<string, ResourceDef>

export type ResourceId = keyof typeof RESOURCES
