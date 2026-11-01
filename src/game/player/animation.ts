export type AnimationState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land'

export interface AnimationInput {
  grounded: boolean
  /** Seconds since last on the ground. */
  airTime: number
  verticalSpeed: number
  horizontalSpeed: number
  sprinting: boolean
  /** Seconds since the last landing, and its impact speed, m/s. */
  timeSinceLanding: number
  landingSpeed: number
}

/** How long the landing crouch holds, seconds. */
export const LANDING_TIME = 0.32

/** Brief losses of contact on bumpy ground don't count as being airborne, seconds. */
const AIRBORNE_GRACE = 0.1

/** Picks the animation from the body's physical state. Pure, so it never feeds back into physics. */
export function resolveAnimationState(
  input: AnimationInput,
  walkSpeed: number,
  hardLandingSpeed: number,
): AnimationState {
  const airborne = !input.grounded && (input.airTime > AIRBORNE_GRACE || input.verticalSpeed > 0.5)
  if (airborne) return input.verticalSpeed > 0 ? 'jump' : 'fall'
  if (input.timeSinceLanding < LANDING_TIME && input.landingSpeed >= hardLandingSpeed) return 'land'
  if (input.horizontalSpeed < 0.3) return 'idle'
  return input.sprinting && input.horizontalSpeed > walkSpeed * 1.05 ? 'run' : 'walk'
}
