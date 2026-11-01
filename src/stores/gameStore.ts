import { create } from 'zustand'

/** 'inventory': the backpack is open over a running world, with gameplay input and mouse capture released. */
export type GamePhase = 'menu' | 'playing' | 'inventory' | 'paused'

interface GameState {
  phase: GamePhase
  /** A valid save exists, so the game can be continued. */
  hasSave: boolean
  /** The world has finished generating and rendered its first frames. */
  sceneReady: boolean
  setPhase: (phase: GamePhase) => void
  setHasSave: (hasSave: boolean) => void
  markSceneReady: () => void
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'menu',
  hasSave: false,
  sceneReady: false,
  setPhase: (phase) => set({ phase }),
  setHasSave: (hasSave) => set({ hasSave }),
  markSceneReady: () => set({ sceneReady: true }),
}))
