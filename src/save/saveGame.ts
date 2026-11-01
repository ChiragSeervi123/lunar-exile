import { SAVE } from '@/config/game'
import { REGIONS } from '@/data/regions'
import { STARTING_REGION } from '@/data/player'
import { sanitizeEquipment, sanitizeStacks } from '@/game/inventory'
import { sanitizeSites, type DepositSites } from '@/game/mining'
import type { PlayerSpawn } from '@/game/player'
import { useEconomyStore } from '@/stores/economyStore'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { playerRuntime, worldRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'
import { clamp } from '@/utils/math'

/**
 * Serializable snapshot of persistent game state. Bump SAVE.version on changes. Runtime state
 * (physics bodies, scene objects, particles, aim, partial mining damage, animation) is never saved.
 */
export interface SaveData {
  version: number
  regionId: string
  /** Where the astronaut stood; null means the landing zone. Velocity and physics objects are never saved. */
  player: PlayerSpawn | null
  survival: ReturnType<typeof usePlayerStore.getState>['survival']
  inventory: Pick<ReturnType<typeof useInventoryStore.getState>, 'stacks' | 'equipment'>
  economy: Pick<
    ReturnType<typeof useEconomyStore.getState>,
    'credits' | 'upgradeLevels' | 'ownedShips'
  >
  missions: Pick<ReturnType<typeof useMissionStore.getState>, 'active' | 'completedIds'>
  /** Mining progress in the current region, on the save's own play clock. */
  world: { playTime: number } & DepositSites
}

function currentPlayer(): PlayerSpawn | null {
  if (!playerRuntime.active) return usePlayerStore.getState().spawnPoint
  const { x, y, z } = playerRuntime.position
  return { position: [x, y, z], facing: playerRuntime.facing }
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

function isPlayerSpawn(value: unknown): value is PlayerSpawn {
  const spawn = value as PlayerSpawn | null
  return (
    Array.isArray(spawn?.position) &&
    spawn.position.length === 3 &&
    spawn.position.every(Number.isFinite) &&
    Number.isFinite(spawn.facing)
  )
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
  if (data.version !== SAVE.version) return null

  const world = isRecord(data.world) ? data.world : {}
  const playTime =
    typeof world.playTime === 'number' && Number.isFinite(world.playTime) ? Math.max(0, world.playTime) : 0
  const inventory = isRecord(data.inventory) ? data.inventory : {}
  return {
    version: SAVE.version,
    regionId: typeof data.regionId === 'string' && data.regionId in REGIONS ? data.regionId : STARTING_REGION,
    player: isPlayerSpawn(data.player) ? data.player : null,
    survival: sanitizeSurvival(data.survival),
    inventory: { stacks: sanitizeStacks(inventory.stacks), equipment: sanitizeEquipment(inventory.equipment) },
    economy: sanitizeEconomy(data.economy),
    missions: sanitizeMissions(data.missions),
    world: { playTime, ...sanitizeSites(world, playTime) },
  }
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
