import { getRegionTerrain } from '@/game/world'
import { inputState } from '@/input/inputState'
import { useGameStore } from '@/stores/gameStore'
import { useInputStore } from '@/stores/inputStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, playerAnimation, playerMotion, playerRuntime } from '@/stores/runtime'
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
  const terrain = () => getRegionTerrain(useWorldStore.getState().regionId)
  window.__lunarDebug = {
    player: playerRuntime,
    motion: playerMotion,
    animation: playerAnimation,
    camera: cameraRuntime,
    input: inputState,
    heightAt: (x: number, z: number) => terrain().heightAt(x, z),
    spawn: () => terrain().spawn,
    stores: { game: useGameStore, player: usePlayerStore, input: useInputStore, settings: useSettingsStore },
  }
}
