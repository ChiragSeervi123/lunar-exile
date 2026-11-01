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

export function saveToStorage(): void {
  localStorage.setItem(SAVE.storageKey, JSON.stringify(createSave()))
}

/** Returns false when there is no usable save (missing, corrupt, or other version). */
export function loadFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(SAVE.storageKey)
    if (!raw) return false
    const data = JSON.parse(raw) as SaveData
    if (data.version !== SAVE.version) return false
    applySave(data)
    return true
  } catch {
    return false
  }
}
