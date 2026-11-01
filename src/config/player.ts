/** Character controller feel. Speeds and jump strength are player stats in data/player.ts. */
export const PLAYER_CONTROLLER = {
  /** Capsule collider, 1.8 m tall overall. */
  radius: 0.32,
  halfHeight: 0.58,
  /** Gap the character controller keeps from surfaces, meters. */
  skin: 0.02,
  /** Horizontal acceleration toward the input velocity, m/s². Air control is deliberately weaker. */
  groundAcceleration: 30,
  groundDeceleration: 24,
  airAcceleration: 7,
  airDeceleration: 1.5,
  /** How quickly the body turns to face its movement (higher is snappier). */
  turnSharpness: 12,
  /**
   * Multiplier on lunar gravity for the player. True lunar gravity (1.62 m/s²) makes a jump last
   * over 4 s; 1.6× keeps jumps long and floaty (~2.4 s, ~2 m high) while staying steerable.
   */
  gravityScale: 1.6,
  /** Extra gravity while descending, so jumps don't hang at the top. */
  fallGravityScale: 1.25,
  maxFallSpeed: 18,
  /**
   * Gentle downward speed while grounded, to keep contact on flat ground, m/s. Kept small because
   * the controller projects it into slopes; snapping does the real work of following the ground.
   */
  groundStickSpeed: 0.3,
  /** Grace periods: jump just after walking off an edge, or just before landing, seconds. */
  coyoteTime: 0.12,
  jumpBufferTime: 0.15,
  /** Steepest walkable slope, and the slope beyond which the body slides, degrees. */
  maxClimbAngle: 50,
  slideAngle: 70,
  /** Small obstacles the body steps onto without jumping, meters. */
  stepHeight: 0.35,
  stepMinWidth: 0.2,
  /** Keeps the body on the ground when walking down slopes and off small drops, meters. */
  snapDistance: 0.35,
  /** Landings faster than this play the landing animation, m/s. */
  hardLandingSpeed: 2.2,
  /** Keeps the body this far inside the playable area's edge, where the terrain collider ends, meters. */
  boundaryMargin: 3,
}
