/** Action -> KeyboardEvent.code. Read through this table, never hardcode keys. */
export const KEYBINDINGS = {
  moveForward: 'KeyW',
  moveBack: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  interact: 'KeyE',
  inventory: 'KeyI',
  toggleCamera: 'KeyV',
  pause: 'Escape',
} as const

export type InputAction = keyof typeof KEYBINDINGS

/** Short on-screen label for a KeyboardEvent.code, e.g. 'KeyE' -> 'E', 'Escape' -> 'ESC'. */
export function keyLabel(code: string): string {
  if (code === 'Escape') return 'ESC'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Shift')) return 'SHIFT'
  return code.toUpperCase()
}
