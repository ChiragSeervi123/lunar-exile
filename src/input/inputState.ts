import { KEYBINDINGS, type InputAction } from '@/config/input'

/**
 * Live gameplay input: written by the DOM listeners in controls.ts, read by the player controller
 * every physics step and by the camera every frame. Not reactive.
 */
export const inputState = {
  /** KeyboardEvent.code of every key held down, and 'Mouse<button>' for mouse buttons held while captured. */
  held: new Set<string>(),
  /** Mouse movement since the camera last consumed it, pixels. */
  lookX: 0,
  lookY: 0,
  /** A jump press waiting for the next physics step. */
  jumpQueued: false,
  /** An interact press waiting for the mining system. */
  interactQueued: false,
}

export function isHeld(action: InputAction): boolean {
  for (const code of KEYBINDINGS[action]) if (inputState.held.has(code)) return true
  return false
}

/** -1, 0 or 1 from a pair of opposing actions. */
export function axis(positive: InputAction, negative: InputAction): number {
  return (isHeld(positive) ? 1 : 0) - (isHeld(negative) ? 1 : 0)
}

export function resetInput(): void {
  inputState.held.clear()
  inputState.lookX = 0
  inputState.lookY = 0
  inputState.jumpQueued = false
  inputState.interactQueued = false
}
