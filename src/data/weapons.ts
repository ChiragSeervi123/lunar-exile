import type { WeaponDef } from '@/types/content'

export const WEAPONS = {
  'plasma-pistol': {
    name: 'Plasma Pistol',
    damage: 12,
    fireRate: 3,
    range: 40,
    magazineSize: 12,
  },
} satisfies Record<string, WeaponDef>

export type WeaponId = keyof typeof WEAPONS
