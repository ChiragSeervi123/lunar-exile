/**
 * Action -> KeyboardEvent.code values. Codes are physical key positions, so WASD stays in place on
 * other layouts. Read through this table, never hardcode keys.
 */
export const KEYBINDINGS = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  toggleCamera: ['KeyV'],
  interact: ['KeyE'],
  inventory: ['KeyI'],
  pause: ['Escape'],
} as const satisfies Record<string, readonly string[]>

export type InputAction = keyof typeof KEYBINDINGS

const ACTION_BY_CODE = new Map<string, InputAction>(
  (Object.keys(KEYBINDINGS) as InputAction[]).flatMap((action) =>
    KEYBINDINGS[action].map((code) => [code, action] as const),
  ),
)

export function actionForCode(code: string): InputAction | undefined {
  return ACTION_BY_CODE.get(code)
}

/** Short on-screen label for a KeyboardEvent.code, e.g. 'KeyE' -> 'E', 'Escape' -> 'ESC'. */
export function keyLabel(code: string): string {
  if (code === 'Escape') return 'ESC'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Shift')) return 'SHIFT'
  return code.toUpperCase()
}

/** Label for an action's primary key. */
export function actionLabel(action: InputAction): string {
  return keyLabel(KEYBINDINGS[action][0])
}
