import { lockPointer, unlockPointer } from '@/input/controls'
import { loadFromStorage, saveProgress } from '@/save/saveGame'
import { useEconomyStore } from '@/stores/economyStore'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMiningStore } from '@/stores/miningStore'
import { useMissionStore } from '@/stores/missionStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { usePlayerStore } from '@/stores/playerStore'
import { resetMining, worldRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'

/*
 * Session flow: moving between the menu, the game, the inventory and the pause menu, with the save
 * and mouse capture that go with each. Called from clicks and key presses, which browsers require
 * before they allow pointer lock.
 */

/** Clears what belongs to one play session but is never saved. */
function resetSessionState(): void {
  resetMining()
  useMiningStore.setState(useMiningStore.getInitialState(), true)
  useNotificationStore.getState().clear()
}

function resetGameState(): void {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true)
  useInventoryStore.setState(useInventoryStore.getInitialState(), true)
  useEconomyStore.setState(useEconomyStore.getInitialState(), true)
  useMissionStore.setState(useMissionStore.getInitialState(), true)
  useWorldStore.setState(useWorldStore.getInitialState(), true)
  worldRuntime.playTime = 0
  resetSessionState()
}

export function startNewGame(): void {
  resetGameState()
  // Save immediately so the run can be continued later.
  saveProgress()
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function continueGame(): void {
  if (!loadFromStorage()) {
    useGameStore.getState().setHasSave(false)
    return
  }
  resetSessionState()
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function pauseGame(): void {
  if (useGameStore.getState().phase !== 'playing') return
  useGameStore.getState().setPhase('paused')
  unlockPointer()
  saveProgress()
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

/** Opens the backpack over the running world, releasing the mouse for the UI. */
export function openInventory(): void {
  if (useGameStore.getState().phase !== 'playing') return
  // The phase changes first, so losing mouse capture here doesn't pause the game.
  useGameStore.getState().setPhase('inventory')
  unlockPointer()
}

export function closeInventory(): void {
  if (useGameStore.getState().phase !== 'inventory') return
  useGameStore.getState().setPhase('playing')
  lockPointer()
}

export function toggleInventory(): void {
  if (useGameStore.getState().phase === 'inventory') closeInventory()
  else openInventory()
}

export function exitToMenu(): void {
  saveProgress()
  useGameStore.getState().setPhase('menu')
  unlockPointer()
  resetSessionState()
}
