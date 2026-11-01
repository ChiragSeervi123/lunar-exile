import type { AnimationState, Vec3 } from '@/game/player'

/*
 * Transient per-frame state shared between systems. Written inside physics steps and useFrame
 * callbacks, read by the camera, animation, lighting and save system. Mutated in place to avoid
 * allocations and React re-renders: never read during render, never serialised directly.
 */

/** Where the player body is. */
export const playerRuntime = {
  /** A player body exists in the scene. */
  active: false,
  /** Feet position after the last physics step. */
  position: { x: 0, y: 0, z: 0 } as Vec3,
  /** Feet position interpolated for the current frame, for the camera, shadows and effects. */
  renderPosition: { x: 0, y: 0, z: 0 } as Vec3,
  /** Body yaw, radians clockwise from north (-Z). */
  facing: 0,
}

/** How the player body is moving (physics state). */
export const playerMotion = {
  velocity: { x: 0, y: 0, z: 0 } as Vec3,
  grounded: true,
  airTime: 0,
  sprinting: false,
  /** Seconds since the last landing, and its impact speed, m/s. */
  timeSinceLanding: 1e3,
  landingSpeed: 0,
}

/** What the astronaut model is showing. */
export const playerAnimation = {
  state: 'idle' as AnimationState,
}

/** Where the camera is and looks. */
export const cameraRuntime = {
  /** Radians clockwise from north (-Z). */
  yaw: 0,
  /** Radians, positive looks up. */
  pitch: 0,
  position: { x: 0, y: 0, z: 0 } as Vec3,
  /** The camera is inside or right next to the helmet, so the body is hidden from it. */
  bodyHidden: false,
}

export function placePlayer(x: number, y: number, z: number, facing: number): void {
  playerRuntime.active = true
  playerRuntime.position = { x, y, z }
  playerRuntime.renderPosition = { x, y, z }
  playerRuntime.facing = facing
  playerMotion.velocity = { x: 0, y: 0, z: 0 }
  playerMotion.grounded = true
  playerMotion.airTime = 0
  playerMotion.sprinting = false
  playerMotion.timeSinceLanding = 1e3
  playerMotion.landingSpeed = 0
  playerAnimation.state = 'idle'
}

export function removePlayer(): void {
  playerRuntime.active = false
  cameraRuntime.bodyHidden = false
}
