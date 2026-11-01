import { create } from 'zustand'
import type { CameraMode, PlayerSpawn } from '@/game/player'
import {
  baseSurvivalMax,
  fullSurvivalStats,
  type SurvivalMax,
  type SurvivalStats,
} from '@/game/survival'

interface PlayerState {
  survival: SurvivalStats
  survivalMax: SurvivalMax
  cameraMode: CameraMode
  /** Where the body appears next time it is created: a saved position, or null for the landing zone. */
  spawnPoint: PlayerSpawn | null
  setSurvival: (patch: Partial<SurvivalStats>) => void
  setCameraMode: (cameraMode: CameraMode) => void
  toggleCameraMode: () => void
}

const max = baseSurvivalMax()

export const usePlayerStore = create<PlayerState>((set) => ({
  survival: fullSurvivalStats(max),
  survivalMax: max,
  cameraMode: 'third-person',
  spawnPoint: null,
  setSurvival: (patch) => set((s) => ({ survival: { ...s.survival, ...patch } })),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleCameraMode: () =>
    set((s) => ({
      cameraMode: s.cameraMode === 'first-person' ? 'third-person' : 'first-person',
    })),
}))
