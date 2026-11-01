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
