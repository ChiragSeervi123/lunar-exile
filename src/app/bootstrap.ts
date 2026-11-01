import { initAudio } from '@/audio/audioManager'
import { hasSavedGame } from '@/save/saveGame'
import { useGameStore } from '@/stores/gameStore'
import { exposeDebugHandles } from './debug'

/** One-time startup before the first render. */
export function bootstrapGame(): void {
  useGameStore.getState().setHasSave(hasSavedGame())
  initAudio()
  exposeDebugHandles()
}
