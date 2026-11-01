export type CameraMode = 'first-person' | 'third-person'

/** Per-frame movement intent, produced by input and consumed by the player body. */
export interface MovementInput {
  forward: number
  strafe: number
  jump: boolean
  sprint: boolean
}

export const NO_INPUT: MovementInput = { forward: 0, strafe: 0, jump: false, sprint: false }
