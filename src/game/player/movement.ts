export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface MotorConfig {
  walkSpeed: number
  sprintSpeed: number
  jumpSpeed: number
  groundAcceleration: number
  groundDeceleration: number
  airAcceleration: number
  airDeceleration: number
  turnSharpness: number
  /** Gravity while rising, m/s². */
  gravity: number
  fallGravityScale: number
  maxFallSpeed: number
  groundStickSpeed: number
  coyoteTime: number
  jumpBufferTime: number
}

export interface MotorInput {
  /** -1..1, positive forward. */
  forward: number
  /** -1..1, positive right. */
  strafe: number
  sprint: boolean
  /** Jump was pressed since the last step. */
  jump: boolean
  /** Camera yaw that movement is relative to, radians clockwise from north (-Z). */
  viewYaw: number
  /** First person: the body always faces the view instead of its movement. */
  faceView: boolean
}

export interface MotorState {
  velocity: Vec3
  /** Body yaw, radians clockwise from north (-Z). */
  facing: number
  grounded: boolean
  /** Seconds since the body last stood on something. */
  airTime: number
  /** Seconds left on a buffered jump press. */
  jumpBuffer: number
  /** Took off by jumping and hasn't landed since; blocks a second jump. */
  jumped: boolean
  /** Sprint held while moving. */
  sprinting: boolean
}

export function createMotorInput(): MotorInput {
  return { forward: 0, strafe: 0, sprint: false, jump: false, viewYaw: 0, faceView: false }
}

export function createMotorState(facing: number): MotorState {
  return {
    velocity: { x: 0, y: 0, z: 0 },
    facing,
    grounded: true,
    airTime: 0,
    jumpBuffer: 0,
    jumped: false,
    sprinting: false,
  }
}

/** Angle wrapped to -π..π. */
export function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/**
 * Advances the desired velocity for one fixed step: camera-relative acceleration, turning,
 * gravity and jumping. Collision resolution follows in `resolveMotor`. Returns true when a jump
 * starts this step.
 */
export function updateMotor(state: MotorState, input: MotorInput, dt: number, config: MotorConfig): boolean {
  state.jumpBuffer = input.jump ? config.jumpBufferTime : Math.max(0, state.jumpBuffer - dt)

  // Diagonals are no faster than straight lines.
  let forward = input.forward
  let strafe = input.strafe
  const amount = Math.hypot(forward, strafe)
  if (amount > 1) {
    forward /= amount
    strafe /= amount
  }
  const sin = Math.sin(input.viewYaw)
  const cos = Math.cos(input.viewYaw)
  const dirX = sin * forward + cos * strafe
  const dirZ = -cos * forward + sin * strafe
  const moving = amount > 1e-3
  state.sprinting = input.sprint && moving
  const speed = state.sprinting ? config.sprintSpeed : config.walkSpeed

  // Accelerate toward the target velocity rather than snapping to it.
  const rate = state.grounded
    ? moving
      ? config.groundAcceleration
      : config.groundDeceleration
    : moving
      ? config.airAcceleration
      : config.airDeceleration
  const v = state.velocity
  const dx = dirX * speed - v.x
  const dz = dirZ * speed - v.z
  const gap = Math.hypot(dx, dz)
  const step = rate * dt
  if (gap <= step) {
    v.x += dx
    v.z += dz
  } else {
    v.x += (dx / gap) * step
    v.z += (dz / gap) * step
  }

  if (input.faceView) state.facing = input.viewYaw
  else if (moving) {
    const target = Math.atan2(dirX, -dirZ)
    const turn = 1 - Math.exp(-config.turnSharpness * dt)
    state.facing = wrapAngle(state.facing + wrapAngle(target - state.facing) * turn)
  }

  const canJump = !state.jumped && (state.grounded || state.airTime < config.coyoteTime)
  if (state.jumpBuffer > 0 && canJump) {
    v.y = config.jumpSpeed
    state.jumpBuffer = 0
    state.jumped = true
    state.grounded = false
    return true
  }
  if (state.grounded) v.y = -config.groundStickSpeed
  else {
    const gravity = config.gravity * (v.y < 0 ? config.fallGravityScale : 1)
    v.y = Math.max(-config.maxFallSpeed, v.y - gravity * dt)
  }
  return false
}

/**
 * Removes the part of the horizontal velocity that pushes into a wall, so the body slides along it
 * instead of building up speed against it. (nx, nz) is the wall's normal, pointing away from it.
 * Slopes and ground contacts deliberately don't go through here: they must not bleed speed.
 */
export function slideAlongWall(state: MotorState, nx: number, nz: number): void {
  const length = Math.hypot(nx, nz)
  if (length < 1e-6) return
  const ux = nx / length
  const uz = nz / length
  const into = state.velocity.x * ux + state.velocity.z * uz
  if (into < 0) {
    state.velocity.x -= into * ux
    state.velocity.z -= into * uz
  }
}

/**
 * Applies what actually happened after collision: touching down, leaving the ground and bumping
 * into something overhead. `moved` and `desired` are this step's displacements. Returns the impact
 * speed (m/s) when the body lands this step, otherwise 0.
 */
export function resolveMotor(state: MotorState, grounded: boolean, moved: Vec3, desired: Vec3, dt: number): number {
  const v = state.velocity
  if (grounded) {
    const impact = state.grounded ? 0 : Math.max(0, -v.y)
    state.grounded = true
    state.airTime = 0
    state.jumped = false
    return impact
  }
  state.grounded = false
  state.airTime += dt
  // Bumped into something overhead: stop rising.
  if (v.y > 0 && moved.y < desired.y * 0.5) v.y = 0
  return 0
}
