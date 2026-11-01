import { lockPointer, unlockPointer } from '@/input/controls'
import { hasSavedGame, loadFromStorage, saveToStorage } from '@/save/saveGame'
import { useEconomyStore } from '@/stores/economyStore'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMissionStore } from '@/stores/missionStore'
import { usePlayerStore } from '@/stores/playerStore'
import { useWorldStore } from '@/stores/worldStore'

/*
 * Session flow: moving between the menu, the game and the pause menu, with the save and mouse
 * capture that go with each. Called from clicks and key presses, which browsers require before
 * they allow pointer lock.
 */

function resetGameState(): void {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true)
  useInventoryStore.setState(useInventoryStore.getInitialState(), true)
  useEconomyStore.setState(useEconomyStore.getInitialState(), true)
  useMissionStore.setState(useMissionStore.getInitialState(), true)
  useWorldStore.setState(useWorldStore.getInitialState(), true)
}

function save(): void {
  useGameStore.getState().setHasSave(saveToStorage() || hasSavedGame())
}

export function startNewGame(): void {
  resetGameState()
  // Save immediately so the run can be continued later.
  save()
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function continueGame(): void {
  if (!loadFromStorage()) {
    useGameStore.getState().setHasSave(false)
    return
  }
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function pauseGame(): void {
  if (useGameStore.getState().phase !== 'playing') return
  useGameStore.getState().setPhase('paused')
  unlockPointer()
  save()
}

export function resumeGame(): void {
  if (useGameStore.getState().phase !== 'paused') return
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function togglePause(): void {
  if (useGameStore.getState().phase === 'playing') pauseGame()
  else resumeGame()
}

export function exitToMenu(): void {
  save()
  useGameStore.getState().setPhase('menu')
  unlockPointer()
}
