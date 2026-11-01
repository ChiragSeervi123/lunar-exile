import type { ShipDef } from '@/types/content'

export const SHIPS = {
  'scout-lander': { name: 'Scout Lander', cargoCapacity: 200, price: 0 },
} satisfies Record<string, ShipDef>

export type ShipId = keyof typeof SHIPS
