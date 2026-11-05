import { Vector3 } from 'three'
import { CAMERA } from '@/config/camera'
import { frameDirection, toWorld, type Frame, type Planet } from '@/game/planet'
import type { Vec3 } from '@/game/player'
import { vec3 } from '@/utils/vec3'
import type { CameraPose } from './shots'

/** Unit view direction for a yaw (radians clockwise from north) and pitch (radians, positive up) in `frame`. */
export function viewDirection(frame: Frame, yaw: number, pitch: number, out: Vector3): Vector3 {
  frameDirection(frame, yaw, pitch, out)
  return out
}

/** How far a probe sphere can travel from `origin` along unit `direction`, up to `maxDistance`. */
export type ProbeCast = (origin: Vector3, direction: Vector3, maxDistance: number) => number

export interface FollowState {
  /** Smoothed point the camera orbits, above the astronaut's shoulders. */
  pivot: Vector3
  /** Current distance from the pivot after obstructions. */
  distance: number
  ready: boolean
}

export function createFollowState(): FollowState {
  return { pivot: new Vector3(), distance: CAMERA.thirdPerson.distance, ready: false }
}

const view = new Vector3()
const boom = new Vector3()
const goal = new Vector3()
const side = vec3()
const local = vec3()
const dir = vec3()

/** Keeps `p` at least `clearance` meters above the Moon's exact ground, moving it straight up if needed. */
export function keepAboveGround(planet: Planet, p: Vector3, clearance: number): Vector3 {
  const r = p.length()
  dir.x = p.x / r
  dir.y = p.y / r
  dir.z = p.z / r
  const floor = planet.surfaceRadius(dir) + clearance
  if (r < floor) p.multiplyScalar(floor / r)
  return p
}

/**
 * Third person: orbit a point above the shoulders, over the right shoulder, in the astronaut's own
 * frame (so "up" is away from the Moon's centre wherever it stands). A sphere swept from that
 * point keeps the camera in front of terrain and rocks.
 */
export function thirdPersonPose(
  state: FollowState,
  feet: Vec3,
  frame: Frame,
  yaw: number,
  pitch: number,
  dt: number,
  cast: ProbeCast,
  planet: Planet,
  out: CameraPose,
  /** The astronaut is in a cave: the walls (colliders) hold the camera in, not the ground above. */
  underground = false,
): CameraPose {
  const c = CAMERA.thirdPerson
  const up = frame.up
  goal.set(feet.x + up.x * c.pivotHeight, feet.y + up.y * c.pivotHeight, feet.z + up.z * c.pivotHeight)
  if (!state.ready) state.pivot.copy(goal)
  else {
    // Tight along the ground so the view never feels delayed; softer vertically so jumps and
    // landings don't jolt it.
    const follow = 1 - Math.exp(-c.followSharpness * dt)
    const rise = 1 - Math.exp(-c.verticalSharpness * dt)
    const ex = goal.x - state.pivot.x
    const ey = goal.y - state.pivot.y
    const ez = goal.z - state.pivot.z
    const vertical = ex * up.x + ey * up.y + ez * up.z
    state.pivot.x += (ex - up.x * vertical) * follow + up.x * vertical * rise
    state.pivot.y += (ey - up.y * vertical) * follow + up.y * vertical * rise
    state.pivot.z += (ez - up.z * vertical) * follow + up.z * vertical * rise
  }

  viewDirection(frame, yaw, pitch, view)
  // Over the right shoulder: the view's right, along the ground (x east, z south in the frame).
  local.x = Math.cos(yaw)
  local.y = 0
  local.z = Math.sin(yaw)
  toWorld(frame, local, side)
  boom.set(side.x * c.shoulderOffset, side.y * c.shoulderOffset, side.z * c.shoulderOffset).addScaledVector(view, -c.distance)
  const reach = boom.length()
  boom.divideScalar(reach)
  const clear = Math.max(0.2, cast(state.pivot, boom, reach) - c.collisionMargin)
  // Pull in at once when something gets in the way; ease back out once it clears.
  if (!state.ready || clear < state.distance) state.distance = clear
  else state.distance += (clear - state.distance) * (1 - Math.exp(-c.zoomOutSharpness * dt))
  state.ready = true

  out.position.copy(state.pivot).addScaledVector(boom, state.distance)
  // Colliders exist only around the astronaut, so also keep above the exact ground.
  if (!underground) keepAboveGround(planet, out.position, c.groundClearance)
  out.target.copy(out.position).addScaledVector(view, 10)
  return out
}

/** First person: at eye level inside the helmet, looking where the mouse points. */
export function firstPersonPose(feet: Vec3, frame: Frame, yaw: number, pitch: number, out: CameraPose): CameraPose {
  viewDirection(frame, yaw, pitch, view)
  const eye = CAMERA.firstPerson.eyeHeight
  out.position.set(feet.x + frame.up.x * eye, feet.y + frame.up.y * eye, feet.z + frame.up.z * eye)
  out.target.copy(out.position).addScaledVector(view, 10)
  return out
}
