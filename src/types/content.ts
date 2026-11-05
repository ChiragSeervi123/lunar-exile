// Shape of all data-driven game content. Definitions live in src/data and are
// keyed by id; cross-references between definitions use plain string ids.

export type ItemKind = 'resource' | 'consumable' | 'tool' | 'equipment'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'extremely-rare'

export interface ItemDef {
  name: string
  description: string
  kind: ItemKind
  rarity: Rarity
  /** Most the player can carry. */
  stackSize: number
  /** Base value in credits; buy/sell prices derive from this. */
  value: number
  /** Swatch colour for icons and notifications. */
  color: string
}

/** Where on the terrain a deposit prefers to form. */
export type Habitat = 'plains' | 'mare' | 'crater-floor' | 'crater-rim'

/** Silhouettes the deposit renderer knows how to build. */
export type DepositShape = 'patch' | 'blocks' | 'vein' | 'crystals' | 'spires' | 'relic'

export interface DepositAppearance {
  shape: DepositShape
  color: string
  /** Secondary colour: grains, tips, rock base or alien lights, depending on the shape. */
  accent: string
  /** Glow colour and strength; omit for natural-looking deposits. */
  emissive?: string
  emissiveIntensity?: number
  metalness?: number
  roughness?: number
  /** Soft halo colour, for rare deposits that should catch the eye from a distance. */
  halo?: string
  /** Size multiplier range per deposit. */
  size: [number, number]
}

/** A mineable deposit type. Instances are placed by the world generator. */
export interface ResourceDef {
  name: string
  description: string
  /** Item granted when mined. */
  itemId: string
  category: 'mineral' | 'metal' | 'isotope' | 'crystal' | 'artifact'
  rarity: Rarity
  habitat: Habitat
  /** Deposit health at size 1. */
  health: number
  /** Extraction difficulty: the tool's mining power is divided by this. */
  hardness: number
  yield: { min: number; max: number }
  /** Play time before a depleted deposit grows back, seconds; null = gone for good. */
  respawnSeconds: number | null
  appearance: DepositAppearance
}

export interface ToolDef {
  name: string
  description: string
  /** Deposit health removed per second at hardness 1. */
  power: number
  /** Reach from the astronaut's chest to the deposit, meters. */
  range: number
  beamColor: string
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
  /** Deposit types found here, with deposits per hectare of playable area. */
  resourceNodes: { resourceId: string; density: number }[]
  enemySpawns: { enemyId: string; count: number }[]
}

/** The Moon as a whole: a sphere of provinces around the flat landing-site region. */
export interface MoonDef {
  name: string
  /** Mean radius, meters. */
  radius: number
  seed: number
  /** Region whose flat map becomes the landing site, at the +Y pole. */
  landingRegion: string
  /**
   * Selenographic coordinates of the landing point, degrees (north and east positive). They fix
   * latitude and longitude everywhere: north at the landing point is the flat map's north.
   */
  landingCoordinates: { latitude: number; longitude: number }
  /** How many provinces the surface is divided into. */
  provinces: number
}

/** Kinds of lunar province; each has its own landscape, colour and resources. */
export type ProvinceKind =
  | 'landing-basin'
  | 'mare'
  | 'highlands'
  | 'crater-field'
  | 'mountains'
  | 'rilles'
  | 'regolith-plain'
  | 'mineral'
  | 'anomaly'
  | 'farside-highlands'
  | 'impact-basin'

export interface ProvinceTypeDef {
  label: string
  description: string
  /** Where provinces of this kind form: the Earth-facing near side, the far side, or either. */
  side: 'near' | 'far' | 'any'
  /** Rolling relief and small surface bumps, meters. */
  relief: number
  roughness: number
  /** Crater density relative to the landing site's. */
  craters: number
  /** Height of mountain ridges, meters (0 = none). */
  ridges: number
  /** Depth of sinuous rilles, meters (0 = none). */
  rilles: number
  /** Height of stepped terraces, meters (0 = none): an unnatural, alien landscape. */
  terraces: number
  /** Base brightness: 0 = dark mare basalt, 1 = bright highland regolith. */
  albedo: number
  /** Subtle surface tint (linear RGB, 0..1) and how strongly it shows. */
  tint?: { color: [number, number, number]; strength: number }
  /** Rock and boulder density relative to the landing site's. */
  rocks: number
  /** Deposit types found here and their density per hectare. */
  resources: { resourceId: string; density: number }[]
  /** Names for provinces of this kind, used in order. */
  names: string[]
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
