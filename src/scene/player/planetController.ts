import type { RapierCollider, RapierContext, RapierRigidBody } from '@react-three/rapier'
import { COLLISION } from '@/config/game'
import { PLANET_PHYSICS } from '@/config/planet'
import { PLAYER_CONTROLLER as TUNING } from '@/config/player'
import { copyFrame, createFrame, frameRotation, toLocal, toWorld, transportFrame, type Frame, type Planet } from '@/game/planet'
import { resolveMotor, slideAlongWall, updateMotor, type MotorInput, type MotorState } from '@/game/player'
import { DEG2RAD } from '@/utils/math'
import { dot, length, normalize, quat, setVec, vec3, type Vec3 } from '@/utils/vec3'
import { BODY_CENTER, MOTOR_CONFIG } from './body'

type World = RapierContext['world']

/** Below this ground speed with no movement input, the body is standing still, m/s. */
const STILL_SPEED = 0.05

/** Where a saved game left the astronaut: feet position and the way it faced, world space. */
export interface PlanetPose {
  position: Vec3
  /** Unit vector along the ground. */
  forward: Vec3
}

export interface PlanetSpawn {
  /** Feet position, world space. */
  feet: Vec3
  /** Capsule centre, world space. */
  center: Vec3
  /** The body's local frame there: movement, facing and the camera's yaw are relative to it. */
  frame: Frame
  /** Body yaw in that frame, radians clockwise from its north. */
  facing: number
}

/**
 * A new body's place: the saved spot (which may have been on a rock), or the landing zone facing
 * `defaultFacing`; never below the ground. The frame is the landing site's, carried straight
 * there along the surface, so around the landing site headings match the flat map's. No collider
 * query is made, because colliders built for the spawn only reach the physics world at its next
 * step; the controller holds the body still until then.
 */
export function findPlanetSpawn(planet: Planet, saved: PlanetPose | null, defaultFacing: number): PlanetSpawn {
  const position = saved?.position ?? planet.spawn.position
  const up = normalize(vec3(), position)
  const ground = planet.surfaceRadius(up)
  const r = Math.max(length(position), ground - PLANET_PHYSICS.sinkRecovery) + TUNING.skin
  const frame = transportFrame(copyFrame(createFrame(), planet.spawn.frame), up)
  const facing = saved ? Math.atan2(dot(saved.forward, frame.east), dot(saved.forward, frame.north)) : defaultFacing
  const c = r + BODY_CENTER
  return { feet: vec3(up.x * r, up.y * r, up.z * r), center: vec3(up.x * c, up.y * c, up.z * c), frame, facing }
}

export interface PlanetController {
  /** Holds the body still for a couple of steps, while just-built colliders enter the world (spawn, teleport). */
  settle(): void
  /**
   * Advances one fixed physics step: runs the motor in the body's frame, sweeps the capsule with
   * "up" pointing away from the Moon's centre, sets the body's next position and rotation, and
   * carries `frame` along. Writes the new feet position into `feet`; returns the landing impact
   * speed (0 if none).
   */
  step(body: RapierRigidBody, collider: RapierCollider, motor: MotorState, input: MotorInput, frame: Frame, dt: number, feet: Vec3): number
  /** Times the safety net had to lift the body back out of the ground (should stay at zero). */
  readonly stats: { rescues: number }
  dispose(): void
}

/**
 * Moves the player's kinematic capsule over the spherical Moon. The movement motor is the flat
 * map's, unchanged: it works in the body's local frame (x east, y up, z south), which is carried
 * along the ground by parallel transport, so headings stay continuous everywhere and there are no
 * poles or edges. Gravity pulls toward the Moon's centre; Rapier's character controller handles
 * walls, slopes, steps and snapping with its "up" set to the local vertical every step, and the
 * exact ground is a safety net against tunnelling. There are no boundaries.
 */
export function createPlanetController(world: World, planet: Planet, queryFlags: number): PlanetController {
  const controller = world.createCharacterController(TUNING.skin)
  controller.setMaxSlopeClimbAngle(TUNING.maxClimbAngle * DEG2RAD)
  controller.setMinSlopeSlideAngle(TUNING.slideAngle * DEG2RAD)
  controller.enableAutostep(TUNING.stepHeight, TUNING.stepMinWidth, false)
  controller.enableSnapToGround(TUNING.snapDistance)
  controller.setApplyImpulsesToDynamicBodies(false)
  const { sinkRecovery, groundProbe, settleSteps } = PLANET_PHYSICS
  // Contacts steeper than the climbable slope are walls.
  const wallNormalY = Math.cos(TUNING.maxClimbAngle * DEG2RAD)
  const desiredLocal = vec3()
  const desired = vec3()
  const moved = vec3()
  const movedLocal = vec3()
  const normal = vec3()
  const up = vec3()
  const rotation = quat()
  const next = vec3()
  const stats = { rescues: 0 }
  let hold = settleSteps

  return {
    stats,
    settle() {
      hold = settleSteps
    },
    step(body, collider, motor, input, frame, dt, feet) {
      const from = body.translation()
      if (hold > 0) {
        hold--
        motor.velocity.x = 0
        motor.velocity.y = 0
        motor.velocity.z = 0
        normalize(up, from)
        setVec(feet, from.x - up.x * BODY_CENTER, from.y - up.y * BODY_CENTER, from.z - up.z * BODY_CENTER)
        return 0
      }
      const jumped = updateMotor(motor, input, dt, MOTOR_CONFIG)
      const v = motor.velocity
      setVec(desiredLocal, v.x * dt, v.y * dt, v.z * dt)
      toWorld(frame, desiredLocal, desired)
      controller.setUp(frame.up)
      controller.computeColliderMovement(collider, desired, queryFlags, COLLISION.playerQuery)
      const movement = controller.computedMovement()
      for (let i = controller.numComputedCollisions() - 1; i >= 0; i--) {
        const hit = controller.computedCollision(i)
        if (!hit) continue
        toLocal(frame, hit.normal1, normal)
        if (normal.y < wallNormalY) slideAlongWall(motor, normal.x, normal.z)
      }
      let mx = movement.x
      let my = movement.y
      let mz = movement.z
      // Standing still on walkable ground: the controller turns the small push into the ground into
      // a slide along the slope, which would make the body creep downhill. Only the part straight
      // down is kept. (Ground too steep to stand on isn't "grounded", so the body still slides there.)
      const still = input.forward === 0 && input.strafe === 0 && Math.hypot(v.x, v.z) < STILL_SPEED
      if (still && !jumped && v.y <= 0 && controller.computedGrounded()) {
        const down = mx * frame.up.x + my * frame.up.y + mz * frame.up.z
        mx = frame.up.x * down
        my = frame.up.y * down
        mz = frame.up.z * down
      }
      let x = from.x + mx
      let y = from.y + my
      let z = from.z + mz
      let r = Math.hypot(x, y, z)
      setVec(up, x / r, y / r, z / r)
      // Safety net from the exact ground: lift the body back out if it ever tunnels through.
      const ground = planet.surfaceRadius(up)
      if (r - BODY_CENTER < ground - sinkRecovery) {
        stats.rescues++
        r = ground + BODY_CENTER
        x = up.x * r
        y = up.y * r
        z = up.z * r
      }
      toLocal(frame, setVec(moved, x - from.x, y - from.y, z - from.z), movedLocal)
      const touching = controller.computedGrounded() || r - BODY_CENTER - ground < groundProbe
      const impact = resolveMotor(motor, !jumped && v.y <= 0 && touching, movedLocal, desiredLocal, dt)
      transportFrame(frame, up)
      body.setNextKinematicTranslation(setVec(next, x, y, z))
      body.setNextKinematicRotation(frameRotation(frame, rotation))
      setVec(feet, x - up.x * BODY_CENTER, y - up.y * BODY_CENTER, z - up.z * BODY_CENTER)
      return impact
    },
    dispose() {
      world.removeCharacterController(controller)
    },
  }
}
