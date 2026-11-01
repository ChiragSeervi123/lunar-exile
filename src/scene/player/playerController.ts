import type { RapierCollider, RapierContext, RapierRigidBody } from '@react-three/rapier'
import { COLLISION, PHYSICS } from '@/config/game'
import { PLAYER_CONTROLLER as TUNING } from '@/config/player'
import { PLAYER_BASE } from '@/data/player'
import {
  resolveMotor,
  slideAlongWall,
  updateMotor,
  type MotorConfig,
  type MotorInput,
  type MotorState,
  type PlayerSpawn,
  type Vec3,
} from '@/game/player'
import type { Terrain } from '@/game/world'
import { clamp, DEG2RAD } from '@/utils/math'

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

/** Height of the capsule's centre above the feet. */
export const BODY_CENTER = TUNING.halfHeight + TUNING.radius

export const MOTOR_CONFIG: MotorConfig = {
  walkSpeed: PLAYER_BASE.walkSpeed,
  sprintSpeed: PLAYER_BASE.sprintSpeed,
  jumpSpeed: PLAYER_BASE.jumpSpeed,
  groundAcceleration: TUNING.groundAcceleration,
  groundDeceleration: TUNING.groundDeceleration,
  airAcceleration: TUNING.airAcceleration,
  airDeceleration: TUNING.airDeceleration,
  turnSharpness: TUNING.turnSharpness,
  gravity: -PHYSICS.gravity[1] * TUNING.gravityScale,
  fallGravityScale: TUNING.fallGravityScale,
  maxFallSpeed: TUNING.maxFallSpeed,
  groundStickSpeed: TUNING.groundStickSpeed,
  coyoteTime: TUNING.coyoteTime,
  jumpBufferTime: TUNING.jumpBufferTime,
}

/**
 * How far the feet may sit below the exact terrain before being lifted back out, meters. Larger
 * than the worst gap between the 3 m collider and the exact terrain (~0.4 m).
 */
const SINK_RECOVERY = 0.6
/** Feet this close above the exact terrain count as grounded even if the controller missed the contact, meters. */
const GROUND_PROBE = 0.08
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 }
const DOWN = { x: 0, y: -1, z: 0 }

/**
 * Feet position for a new body: the saved spot or the landing zone, kept inside the playable
 * area and set on the first surface below it (terrain or rock), found with a shape cast.
 */
export function findSpawn(
  world: World,
  rapier: Rapier,
  terrain: Terrain,
  saved: PlayerSpawn | null,
  facing: number,
): { x: number; y: number; z: number; facing: number } {
  const bound = terrain.playableHalfSize - TUNING.boundaryMargin
  const x = clamp(saved?.position[0] ?? terrain.spawn.x, -bound, bound)
  const z = clamp(saved?.position[2] ?? terrain.spawn.z, -bound, bound)
  const ground = terrain.heightAt(x, z)
  const top = Math.max(ground, saved?.position[1] ?? ground) + 2
  const probe = new rapier.Ball(0.1)
  const hit = world.castShape({ x, y: top, z }, IDENTITY, DOWN, probe, 0, 20, true, undefined, COLLISION.playerQuery)
  const surface = hit ? top - hit.time_of_impact - 0.1 : ground
  return { x, y: Math.max(surface, ground - SINK_RECOVERY) + TUNING.skin, z, facing: saved?.facing ?? facing }
}

export interface PlayerController {
  /**
   * Advances one fixed physics step: runs the motor, sweeps the capsule, and sets the body's next
   * position. Writes the new feet position into `feet`; returns the landing impact speed (0 if none).
   */
  step(body: RapierRigidBody, collider: RapierCollider, motor: MotorState, input: MotorInput, dt: number, feet: Vec3): number
  dispose(): void
}

/**
 * Moves the player's kinematic capsule with Rapier's character controller, which sweeps the shape
 * against the terrain heightfield and rocks (walls, slopes, steps, snapping), with the exact
 * terrain height as a safety net for grounding and tunnelling.
 */
export function createPlayerController(world: World, terrain: Terrain, queryFlags: number): PlayerController {
  const controller = world.createCharacterController(TUNING.skin)
  controller.setUp({ x: 0, y: 1, z: 0 })
  controller.setMaxSlopeClimbAngle(TUNING.maxClimbAngle * DEG2RAD)
  controller.setMinSlopeSlideAngle(TUNING.slideAngle * DEG2RAD)
  controller.enableAutostep(TUNING.stepHeight, TUNING.stepMinWidth, false)
  controller.enableSnapToGround(TUNING.snapDistance)
  controller.setApplyImpulsesToDynamicBodies(false)
  const bound = terrain.playableHalfSize - TUNING.boundaryMargin
  // Contacts steeper than the climbable slope are walls.
  const wallNormalY = Math.cos(TUNING.maxClimbAngle * DEG2RAD)
  const desired: Vec3 = { x: 0, y: 0, z: 0 }
  const moved: Vec3 = { x: 0, y: 0, z: 0 }

  return {
    step(body, collider, motor, input, dt, feet) {
      const jumped = updateMotor(motor, input, dt, MOTOR_CONFIG)
      const v = motor.velocity
      desired.x = v.x * dt
      desired.y = v.y * dt
      desired.z = v.z * dt
      controller.computeColliderMovement(collider, desired, queryFlags, COLLISION.playerQuery)
      const movement = controller.computedMovement()
      for (let i = controller.numComputedCollisions() - 1; i >= 0; i--) {
        const normal = controller.computedCollision(i)?.normal1
        if (normal && normal.y < wallNormalY) slideAlongWall(motor, normal.x, normal.z)
      }
      const from = body.translation()
      let x = from.x + movement.x
      let y = from.y + movement.y
      let z = from.z + movement.z

      // The terrain collider ends at the edge of the playable area.
      if (Math.abs(x) > bound) {
        x = clamp(x, -bound, bound)
        v.x = 0
      }
      if (Math.abs(z) > bound) {
        z = clamp(z, -bound, bound)
        v.z = 0
      }
      // Safety net from the exact terrain: lift the body back out if it ever tunnels through.
      const ground = terrain.heightAt(x, z)
      if (y - BODY_CENTER < ground - SINK_RECOVERY) y = ground + BODY_CENTER

      moved.x = x - from.x
      moved.y = y - from.y
      moved.z = z - from.z
      const touching = controller.computedGrounded() || y - BODY_CENTER - ground < GROUND_PROBE
      const impact = resolveMotor(motor, !jumped && v.y <= 0 && touching, moved, desired, dt)
      body.setNextKinematicTranslation({ x, y, z })
      feet.x = x
      feet.y = y - BODY_CENTER
      feet.z = z
      return impact
    },
    dispose() {
      world.removeCharacterController(controller)
    },
  }
}
