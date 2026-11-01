import { SAVE } from '@/config/game'
import type { PlayerSpawn } from '@/game/player'
import { useEconomyStore } from '@/stores/economyStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { playerRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'

/** Serializable snapshot of persistent game state. Bump SAVE.version on changes. */
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
  return {
    version: SAVE.version,
    regionId: useWorldStore.getState().regionId,
    player: currentPlayer(),
    survival: usePlayerStore.getState().survival,
    inventory: { stacks, equipment },
    economy: { credits, upgradeLevels, ownedShips },
    missions: { active, completedIds },
  }
}

export function applySave(data: SaveData): void {
  useWorldStore.getState().setRegion(data.regionId)
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

function isPlayerSpawn(value: unknown): value is PlayerSpawn {
  const spawn = value as PlayerSpawn | null
  return (
    Array.isArray(spawn?.position) &&
    spawn.position.length === 3 &&
    spawn.position.every(Number.isFinite) &&
    Number.isFinite(spawn.facing)
  )
}

/** Brings older saves up to the current shape. */
function migrate(data: SaveData): SaveData | null {
  // Version 1 predates the astronaut: start at the landing zone.
  if (data.version === 1) data = { ...data, version: 2, player: null }
  if (data.version !== SAVE.version) return null
  return { ...data, player: isPlayerSpawn(data.player) ? data.player : null }
}

/** The stored save, or null when it is missing, corrupt, or from an unknown save version. */
function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE.storageKey)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData | null
    return data ? migrate(data) : null
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
