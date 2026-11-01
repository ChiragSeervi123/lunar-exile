import { create } from 'zustand'
import type { MissionProgress } from '@/game/missions'

interface MissionState {
  active: MissionProgress[]
  completedIds: string[]
}

export const useMissionStore = create<MissionState>(() => ({
  active: [],
  completedIds: [],
}))
