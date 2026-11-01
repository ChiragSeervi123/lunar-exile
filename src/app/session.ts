import { hasSavedGame, loadFromStorage, saveToStorage } from '@/save/saveGame'
import { useEconomyStore } from '@/stores/economyStore'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useWorldStore } from '@/stores/worldStore'

/** Session flow: moving between the menu and the game, and the save that goes with it. */

function resetGameState(): void {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true)
  useInventoryStore.setState(useInventoryStore.getInitialState(), true)
  useEconomyStore.setState(useEconomyStore.getInitialState(), true)
  useMissionStore.setState(useMissionStore.getInitialState(), true)
  useWorldStore.setState(useWorldStore.getInitialState(), true)
}

export function startNewGame(): void {
  resetGameState()
  // Save immediately so the run can be continued later.
  const saved = saveToStorage()
  useGameStore.setState({ phase: 'playing', hasSave: saved })
}

export function continueGame(): void {
  if (!loadFromStorage()) {
    useGameStore.getState().setHasSave(false)
    return
  }
  useGameStore.getState().setPhase('playing')
}

export function togglePause(): void {
  const { phase, setPhase } = useGameStore.getState()
  if (phase === 'playing') setPhase('paused')
  else if (phase === 'paused') setPhase('playing')
}

export function resumeGame(): void {
  useGameStore.getState().setPhase('playing')
}

export function exitToMenu(): void {
  const saved = saveToStorage()
  useGameStore.setState({ phase: 'menu', hasSave: saved || hasSavedGame() })
}
