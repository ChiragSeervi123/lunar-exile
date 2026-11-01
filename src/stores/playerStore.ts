import { create } from 'zustand'
import type { CameraMode } from '@/game/player'
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
  setSurvival: (patch: Partial<SurvivalStats>) => void
  toggleCameraMode: () => void
}

const max = baseSurvivalMax()

export const usePlayerStore = create<PlayerState>((set) => ({
  survival: fullSurvivalStats(max),
  survivalMax: max,
  cameraMode: 'first-person',
  setSurvival: (patch) => set((s) => ({ survival: { ...s.survival, ...patch } })),
  toggleCameraMode: () =>
    set((s) => ({
      cameraMode: s.cameraMode === 'first-person' ? 'third-person' : 'first-person',
    })),
}))
