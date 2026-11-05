import { SAVE } from '@/config/game'
import { REGIONS } from '@/data/regions'
import { STARTING_REGION } from '@/data/player'
import { sanitizeEquipment, sanitizeStacks } from '@/game/inventory'
import { sanitizeSites, type DepositSites } from '@/game/mining'
import { chartDirection, chartRotation, frameDirection, getPlanet } from '@/game/planet'
import type { PlayerPose } from '@/game/player'
import { useCaveStore } from '@/stores/caveStore'
import { useEconomyStore } from '@/stores/economyStore'
import { useExplorationStore } from '@/stores/explorationStore'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { playerRuntime, worldRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'
import { clamp } from '@/utils/math'
import { quat, rotateVec, vec3 } from '@/utils/vec3'

/**
 * Serializable snapshot of persistent game state. Bump SAVE.version on changes. Runtime state
 * (physics bodies, scene objects, particles, aim, partial mining damage, animation) is never saved.
 */
export interface SaveData {
  version: number
  regionId: string
  /**
   * Where the astronaut stood and faced on the Moon (world space); null means the landing zone.
   * Velocity and physics objects are never saved.
   */
  player: PlayerPose | null
  survival: ReturnType<typeof usePlayerStore.getState>['survival']
  inventory: Pick<ReturnType<typeof useInventoryStore.getState>, 'stacks' | 'equipment'>
  economy: Pick<
    ReturnType<typeof useEconomyStore.getState>,
    'credits' | 'upgradeLevels' | 'ownedShips'
  >
  missions: Pick<ReturnType<typeof useMissionStore.getState>, 'active' | 'completedIds'>
  /** Mining progress in the current region, on the save's own play clock. */
  world: { playTime: number } & DepositSites
  /** Provinces visited and places found (craters, structures, caves), by id. */
  exploration: { provinces: string[]; sites: string[] }
  /** Rock dug out underground: per cave, [x, y, z, radius] spheres in the cave's own frame. */
  caves: Record<string, number[]>
}

const forward = vec3()

function currentPlayer(): PlayerPose | null {
  if (!playerRuntime.active) return usePlayerStore.getState().spawnPoint
  const { x, y, z } = playerRuntime.position
  frameDirection(playerRuntime.frame, playerRuntime.facing, 0, forward)
  return { position: [x, y, z], forward: [forward.x, forward.y, forward.z] }
}

export function createSave(): SaveData {
  const { stacks, equipment } = useInventoryStore.getState()
  const { credits, upgradeLevels, ownedShips } = useEconomyStore.getState()
  const { active, completedIds } = useMissionStore.getState()
  const { regionId, sites } = useWorldStore.getState()
  return {
    version: SAVE.version,
    regionId,
    player: currentPlayer(),
    survival: usePlayerStore.getState().survival,
    inventory: { stacks, equipment },
    economy: { credits, upgradeLevels, ownedShips },
    missions: { active, completedIds },
    world: { playTime: worldRuntime.playTime, depleted: sites.depleted, drops: sites.drops },
    exploration: { provinces: useExplorationStore.getState().provinces, sites: useExplorationStore.getState().sites },
    caves: useCaveStore.getState().digs,
  }
}

export function applySave(data: SaveData): void {
  useWorldStore.getState().setRegion(data.regionId)
  useWorldStore.setState({ sites: { depleted: data.world.depleted, drops: data.world.drops } })
  worldRuntime.playTime = data.world.playTime
  usePlayerStore.setState({ survival: data.survival, spawnPoint: data.player })
  useInventoryStore.setState(data.inventory)
  useEconomyStore.setState(data.economy)
  useMissionStore.setState(data.missions)
  useExplorationStore.setState({ provinces: data.exploration.provinces, sites: data.exploration.sites, banner: null })
  useCaveStore.setState({ digs: data.caves })
}

/** Returns false when storage is unavailable (e.g. blocked or full). */
export function saveToStorage(): boolean {
  try {
    localStorage.setItem(SAVE.storageKey, JSON.stringify(createSave()))
    return true
  } catch {
    return false
  }
}

/** Saves the game now and records whether a save can be continued. */
export function saveProgress(): void {
  useGameStore.getState().setHasSave(saveToStorage() || hasSavedGame())
}

const isVector = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)

/** A pose on the Moon's surface: anything far underground or out in space is damaged data. */
function isPlayerPose(value: unknown): value is PlayerPose {
  const pose = value as PlayerPose | null
  if (!isVector(pose?.position) || !isVector(pose.forward)) return false
  const planet = getPlanet()
  const r = Math.hypot(...pose.position)
  return r > planet.radius + planet.minHeight - 50 && r < planet.radius + planet.maxHeight + 200 && Math.hypot(...pose.forward) > 1e-6
}

/**
 * A player position from versions 2–3, on the flat landing-site map (feet position, and yaw
 * clockwise from north), moved onto the Moon through that map: the same spot, the same height
 * above the ground and the same heading. Null if it isn't one.
 */
function migrateFlatPlayer(value: unknown): PlayerPose | null {
  const spawn = value as { position?: unknown; facing?: unknown } | null
  if (!isVector(spawn?.position) || typeof spawn.facing !== 'number' || !Number.isFinite(spawn.facing)) return null
  const [x, y, z] = spawn.position
  const planet = getPlanet()
  const R = planet.radius
  const dir = chartDirection(x, z, R, vec3())
  const r = R + planet.heightAt(dir) + (y - planet.landing.terrain.heightAt(x, z))
  const f = rotateVec(vec3(), chartRotation(x, z, R, quat()), vec3(Math.sin(spawn.facing), 0, -Math.cos(spawn.facing)))
  return { position: [dir.x * r, dir.y * r, dir.z * r], forward: [f.x, f.y, f.z] }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Survival stats from untrusted data: finite and within range, else full. */
function sanitizeSurvival(raw: unknown): SaveData['survival'] {
  const { survivalMax } = usePlayerStore.getState()
  const source = isRecord(raw) ? raw : {}
  const stat = (key: keyof SaveData['survival']) => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, survivalMax[key]) : survivalMax[key]
  }
  return { health: stat('health'), oxygen: stat('oxygen'), stamina: stat('stamina'), shield: stat('shield') }
}

/** Fields that exist but hold the wrong kind of value fall back to a new game's. */
function sanitizeEconomy(raw: unknown): SaveData['economy'] {
  const initial = useEconomyStore.getInitialState()
  const source = isRecord(raw) ? raw : {}
  const levels = isRecord(source.upgradeLevels) ? source.upgradeLevels : {}
  return {
    credits: typeof source.credits === 'number' && Number.isFinite(source.credits) ? Math.max(0, source.credits) : initial.credits,
    upgradeLevels: Object.fromEntries(
      Object.entries(levels).filter((entry): entry is [string, number] => Number.isSafeInteger(entry[1])),
    ),
    ownedShips: Array.isArray(source.ownedShips)
      ? source.ownedShips.filter((id): id is string => typeof id === 'string')
      : initial.ownedShips,
  }
}

function sanitizeMissions(raw: unknown): SaveData['missions'] {
  const source = isRecord(raw) ? raw : {}
  return {
    active: Array.isArray(source.active) ? (source.active as SaveData['missions']['active']) : [],
    completedIds: Array.isArray(source.completedIds)
      ? source.completedIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

/**
 * Brings older saves up to the current shape, step by step, then checks every field so a damaged
 * or hand-edited save loads with safe values instead of breaking the game. Null for anything that
 * isn't a save, or comes from a newer version of the game.
 */
export function migrate(raw: unknown): SaveData | null {
  if (!isRecord(raw) || typeof raw.version !== 'number') return null
  let data: Record<string, unknown> = raw
  // Version 1 predates the astronaut: start at the landing zone.
  if (data.version === 1) data = { ...data, version: 2, player: null }
  // Version 2 predates mining: nothing mined yet, and the starting tool is added by the checks below.
  if (data.version === 2) data = { ...data, version: 3, world: { playTime: 0, depleted: {}, drops: {} } }
  // Version 3 played on the flat landing-site map: carry the astronaut onto the Moon through it.
  if (data.version === 3) data = { ...data, version: 4, player: migrateFlatPlayer(data.player) }
  // Version 4 predates exploration and caves: nothing found or dug yet.
  if (data.version === 4) data = { ...data, version: 5, exploration: { provinces: [], sites: [] }, caves: {} }
  if (data.version !== SAVE.version) return null

  const world = isRecord(data.world) ? data.world : {}
  const playTime =
    typeof world.playTime === 'number' && Number.isFinite(world.playTime) ? Math.max(0, world.playTime) : 0
  const inventory = isRecord(data.inventory) ? data.inventory : {}
  return {
    version: SAVE.version,
    regionId: typeof data.regionId === 'string' && data.regionId in REGIONS ? data.regionId : STARTING_REGION,
    player: isPlayerPose(data.player) ? data.player : null,
    survival: sanitizeSurvival(data.survival),
    inventory: { stacks: sanitizeStacks(inventory.stacks), equipment: sanitizeEquipment(inventory.equipment) },
    economy: sanitizeEconomy(data.economy),
    missions: sanitizeMissions(data.missions),
    world: { playTime, ...sanitizeSites(world, playTime) },
    exploration: sanitizeExploration(data.exploration),
    caves: sanitizeCaves(data.caves),
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : []

function sanitizeExploration(raw: unknown): SaveData['exploration'] {
  const source = isRecord(raw) ? raw : {}
  return { provinces: strings(source.provinces), sites: strings(source.sites) }
}

/** Dig lists of whole [x, y, z, radius] groups with finite numbers and sensible radii. */
function sanitizeCaves(raw: unknown): SaveData['caves'] {
  const caves: SaveData['caves'] = {}
  for (const [id, list] of Object.entries(isRecord(raw) ? raw : {})) {
    if (!Array.isArray(list)) continue
    const kept: number[] = []
    for (let i = 0; i + 3 < list.length; i += 4) {
      const group = list.slice(i, i + 4)
      if (group.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 500) && group[3] > 0 && group[3] < 3) kept.push(...group)
    }
    if (kept.length > 0) caves[id] = kept
  }
  return caves
}

/** The stored save, or null when it is missing, unreadable, or from an unknown save version. */
function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE.storageKey)
    if (!raw) return null
    return migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

export function hasSavedGame(): boolean {
  return readSave() !== null
}

/** Returns false when there is no usable save. */
export function loadFromStorage(): boolean {
  const data = readSave()
  if (!data) return false
  applySave(data)
  return true
}
