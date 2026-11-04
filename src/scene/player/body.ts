import { PHYSICS } from '@/config/game'
import { PLAYER_CONTROLLER as TUNING } from '@/config/player'
import { PLAYER_BASE } from '@/data/player'
import type { MotorConfig } from '@/game/player'

/** Height of the capsule's centre above the feet. */
export const BODY_CENTER = TUNING.halfHeight + TUNING.radius

/** The movement motor's tuning: speeds and jump from the player's stats, feel from the controller config. */
export const MOTOR_CONFIG: MotorConfig = {
  walkSpeed: PLAYER_BASE.walkSpeed,
  sprintSpeed: PLAYER_BASE.sprintSpeed,
  jumpSpeed: PLAYER_BASE.jumpSpeed,
  groundAcceleration: TUNING.groundAcceleration,
  groundDeceleration: TUNING.groundDeceleration,
  airAcceleration: TUNING.airAcceleration,
  airDeceleration: TUNING.airDeceleration,
  turnSharpness: TUNING.turnSharpness,
  gravity: PHYSICS.lunarGravity * TUNING.gravityScale,
  fallGravityScale: TUNING.fallGravityScale,
  maxFallSpeed: TUNING.maxFallSpeed,
  groundStickSpeed: TUNING.groundStickSpeed,
  coyoteTime: TUNING.coyoteTime,
  jumpBufferTime: TUNING.jumpBufferTime,
}
