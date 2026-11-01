import { getRegionDeposits } from '@/game/mining'
import { getRegionTerrain } from '@/game/world'
import { inputState } from '@/input/inputState'
import { useGameStore } from '@/stores/gameStore'
import { useInputStore } from '@/stores/inputStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMiningStore } from '@/stores/miningStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, miningRuntime, playerAnimation, playerMotion, playerRuntime, worldRuntime } from '@/stores/runtime'
import { useSettingsStore } from '@/stores/settingsStore'
import { useWorldStore } from '@/stores/worldStore'

declare global {
  interface Window {
    __lunarDebug?: unknown
  }
}

/** Read-only handles for automated testing and inspection: in development, or with ?debug in the URL. */
export function exposeDebugHandles(): void {
  if (!import.meta.env.DEV && !new URLSearchParams(window.location.search).has('debug')) return
  const regionId = () => useWorldStore.getState().regionId
  const terrain = () => getRegionTerrain(regionId())
  window.__lunarDebug = {
    player: playerRuntime,
    motion: playerMotion,
    animation: playerAnimation,
    camera: cameraRuntime,
    input: inputState,
    mining: miningRuntime,
    world: worldRuntime,
    heightAt: (x: number, z: number) => terrain().heightAt(x, z),
    spawn: () => terrain().spawn,
    deposits: () => getRegionDeposits(regionId()).list,
    /** Moves the astronaut's feet to (x, z) at the next physics step. */
    teleport: (x: number, z: number) => {
      playerRuntime.teleport = { x, z }
    },
    stores: {
      game: useGameStore,
      player: usePlayerStore,
      input: useInputStore,
      settings: useSettingsStore,
      inventory: useInventoryStore,
      world: useWorldStore,
      mining: useMiningStore,
      notifications: useNotificationStore,
    },
  }
}
