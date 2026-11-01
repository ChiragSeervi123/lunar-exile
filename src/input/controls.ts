import { actionForCode } from '@/config/input'
import { useGameStore } from '@/stores/gameStore'
import { useInputStore } from '@/stores/inputStore'
import { usePlayerStore } from '@/stores/playerStore'
import { inputState, resetInput } from './inputState'

/** Single mouse events larger than this are ignored: some browsers report spikes under pointer lock. */
const MAX_LOOK_DELTA = 300

let lastUnlockAt = -Infinity

const isPlaying = () => useGameStore.getState().phase === 'playing'

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

function attempt(request: () => unknown): Promise<unknown> {
  try {
    return Promise.resolve(request())
  } catch (error) {
    return Promise.reject(error)
  }
}

/** Captures the mouse for looking around. Browsers only allow this from a click or key press. */
export function lockPointer(): void {
  if (document.pointerLockElement) return
  const target = document.body
  // Raw mouse movement (no OS acceleration) where supported, else a plain lock. If both are
  // refused, e.g. right after Esc, the HUD offers click-to-look instead.
  attempt(() => target.requestPointerLock({ unadjustedMovement: true }))
    .catch(() => attempt(() => target.requestPointerLock()))
    .catch(() => {})
}

export function unlockPointer(): void {
  if (document.pointerLockElement) document.exitPointerLock()
}

/** True just after the browser released pointer lock, which Esc does before any key event fires. */
export function pointerJustUnlocked(): boolean {
  return performance.now() - lastUnlockAt < 300
}

interface ControlsOptions {
  /** The mouse was released during play (Esc, alt-tab): the game should pause. */
  onPointerLockLost: () => void
  /** The inventory key was pressed while playing or with the inventory open. */
  onToggleInventory: () => void
}

/** Input code for a mouse button, as used in KEYBINDINGS. */
const mouseCode = (button: number) => `Mouse${button}`

/**
 * Installs the gameplay keyboard and mouse listeners once. Gameplay keys are only taken while
 * playing (the inventory key also while the inventory is open), so menus and settings keep normal
 * keyboard behaviour. Returns a cleanup function.
 */
export function attachControls({ onPointerLockLost, onToggleInventory }: ControlsOptions): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditable(event.target)) return
    const action = actionForCode(event.code)
    if (action === 'inventory') {
      const phase = useGameStore.getState().phase
      if (phase !== 'playing' && phase !== 'inventory') return
      event.preventDefault()
      if (!event.repeat) onToggleInventory()
      return
    }
    if (!isPlaying() || !action || action === 'pause') return
    // No page scroll on Space, and no activating whatever button still has focus.
    event.preventDefault()
    inputState.held.add(event.code)
    if (event.repeat) return
    if (action === 'jump') inputState.jumpQueued = true
    else if (action === 'interact') inputState.interactQueued = true
    else if (action === 'toggleCamera') usePlayerStore.getState().toggleCameraMode()
  }

  const onKeyUp = (event: KeyboardEvent) => {
    inputState.held.delete(event.code)
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!isPlaying()) return
    // Look with the captured mouse, or by dragging when it isn't captured.
    if (!document.pointerLockElement && (event.buttons & 1) === 0) return
    if (Math.abs(event.movementX) > MAX_LOOK_DELTA || Math.abs(event.movementY) > MAX_LOOK_DELTA) return
    inputState.lookX += event.movementX
    inputState.lookY += event.movementY
  }

  const onMouseDown = (event: MouseEvent) => {
    if (!isPlaying()) return
    // With the mouse captured, buttons are gameplay input; otherwise a click on the scene captures it.
    if (document.pointerLockElement) inputState.held.add(mouseCode(event.button))
    else if (event.button === 0 && event.target instanceof HTMLCanvasElement) lockPointer()
  }

  const onMouseUp = (event: MouseEvent) => {
    inputState.held.delete(mouseCode(event.button))
  }

  const onPointerLockChange = () => {
    const locked = document.pointerLockElement !== null
    useInputStore.getState().setPointerLocked(locked)
    if (locked) return
    lastUnlockAt = performance.now()
    if (isPlaying()) onPointerLockLost()
  }

  const onBlur = () => resetInput()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  const unsubscribe = useGameStore.subscribe((state, previous) => {
    if (state.phase === previous.phase) return
    resetInput()
    // Leave no menu button focused, or Space would press it during play.
    if (state.phase === 'playing' && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('pointerlockchange', onPointerLockChange)
    unsubscribe()
    resetInput()
  }
}
