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

export interface CraterTierDef {
  count: number
  minRadius: number
  maxRadius: number
  /** Craters of this tier are scattered within ±spread meters of the region centre. */
  spread: number
}

/** A hand-placed crater, used for composition (e.g. a crater framing the view of Earth). */
export interface LandmarkCraterDef {
  x: number
  z: number
  radius: number
  /** 0 = old and eroded, 1 = fresh with a sharp rim and bright ejecta rays. */
  freshness: number
}

export interface TerrainDef {
  seed: number
  /** Half-size of the generated terrain, including the horizon beyond the playable area, meters. */
  extent: number
  /** Amplitude of broad rolling elevation, meters. */
  relief: number
  /** Amplitude of small surface bumps, meters. */
  roughness: number
  craterTiers: CraterTierDef[]
  landmarks: LandmarkCraterDef[]
  /** Mountain ring around the region: rises from `radius` meters out, peaking near `height`. */
  horizon: { radius: number; height: number }
}

export interface RockFieldDef {
  /** Rocks per 100 m² of playable area. */
  debrisDensity: number
  mediumDensity: number
  boulderDensity: number
  /** Boulders around each crater rim, per 10 m of crater radius. */
  rimBoulders: number
}

/** Degrees. Azimuth is clockwise from north (-Z); elevation is above the horizon. */
export interface SkyAngleDef {
  azimuth: number
  elevation: number
}

export interface SkyDef {
  sun: SkyAngleDef
  /** null where Earth never rises (the lunar far side). */
  earth: (SkyAngleDef & { angularSize: number }) | null
  /** Distance fade toward the horizon colour. */
  fog: { color: string; near: number; far: number }
}

export interface SurfacePaletteDef {
  /** Bright highland regolith. */
  highlands: string
  /** Dark mare basalt. */
  maria: string
  craterFloor: string
  ejecta: string
  rock: string
}

export interface RegionDef {
  name: string
  description: string
  /** Selenographic coordinates shown in the UI. */
  coordinates: string
  /** Side length of the square playable area, centred on the origin, meters. */
  size: number
  /** Where the player arrives; kept level and clear of craters and rocks. */
  spawn: { x: number; z: number }
  terrain: TerrainDef
  rocks: RockFieldDef
  sky: SkyDef
  palette: SurfacePaletteDef
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
