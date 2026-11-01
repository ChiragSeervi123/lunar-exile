import { SAVE } from '@/config/game'
import { useEconomyStore } from '@/stores/economyStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useWorldStore } from '@/stores/worldStore'

/** Serializable snapshot of persistent game state. Bump SAVE.version on changes. */
export interface SaveData {
  version: number
  regionId: string
  survival: ReturnType<typeof usePlayerStore.getState>['survival']
  inventory: Pick<ReturnType<typeof useInventoryStore.getState>, 'stacks' | 'equipment'>
  economy: Pick<
    ReturnType<typeof useEconomyStore.getState>,
    'credits' | 'upgradeLevels' | 'ownedShips'
  >
  missions: Pick<ReturnType<typeof useMissionStore.getState>, 'active' | 'completedIds'>
}

export function createSave(): SaveData {
  const { stacks, equipment } = useInventoryStore.getState()
  const { credits, upgradeLevels, ownedShips } = useEconomyStore.getState()
  const { active, completedIds } = useMissionStore.getState()
  return {
    version: SAVE.version,
    regionId: useWorldStore.getState().regionId,
    survival: usePlayerStore.getState().survival,
    inventory: { stacks, equipment },
    economy: { credits, upgradeLevels, ownedShips },
    missions: { active, completedIds },
  }
}

export function applySave(data: SaveData): void {
  useWorldStore.getState().setRegion(data.regionId)
  usePlayerStore.setState({ survival: data.survival })
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

/** The stored save, or null when it is missing, corrupt, or from another save version. */
function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE.storageKey)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData | null
    return data?.version === SAVE.version ? data : null
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
