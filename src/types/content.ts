// Shape of all data-driven game content. Definitions live in src/data and are
// keyed by id; cross-references between definitions use plain string ids.

export type ItemKind = 'resource' | 'consumable' | 'tool' | 'equipment'

export interface ItemDef {
  name: string
  kind: ItemKind
  stackSize: number
  /** Base value in credits; buy/sell prices derive from this. */
  value: number
}

export interface ResourceDef {
  name: string
  /** Item granted when mined. */
  itemId: string
  /** Higher is slower to mine. */
  hardness: number
  yield: { min: number; max: number }
}

export interface DropDef {
  itemId: string
  chance: number
  quantity: number
}

export interface EnemyDef {
  name: string
  health: number
  speed: number
  damage: number
  detectionRange: number
  attackRange: number
  drops: DropDef[]
}

export interface WeaponDef {
  name: string
  damage: number
  /** Shots per second. */
  fireRate: number
  range: number
  magazineSize: number
  ammoItemId?: string
}

export type MissionObjective =
  | { type: 'collect'; itemId: string; amount: number }
  | { type: 'kill'; enemyId: string; count: number }
  | { type: 'reach'; regionId: string }

export interface MissionDef {
  title: string
  description: string
  objectives: MissionObjective[]
  rewards: { credits: number; items?: { itemId: string; quantity: number }[] }
  /** Missions that must be completed first. */
  requires?: string[]
}

export interface RegionDef {
  name: string
  description: string
  /** Side length of the square region in meters. */
  size: number
  terrain: { seed: number; amplitude: number; roughness: number }
  resourceNodes: { resourceId: string; density: number }[]
  enemySpawns: { enemyId: string; count: number }[]
}

export type PlayerStat = 'maxHealth' | 'maxOxygen' | 'maxStamina' | 'maxShield'

export interface UpgradeDef {
  name: string
  description: string
  stat: PlayerStat
  maxLevel: number
  /** Credit cost to reach each level (length === maxLevel). */
  costs: number[]
  /** Stat increase per level. */
  perLevel: number
}

export interface ShipDef {
  name: string
  cargoCapacity: number
  price: number
}
