import { Vector3 } from 'three'
import { CAMERA } from '@/config/camera'
import type { Vec3 } from '@/game/player'
import type { Terrain } from '@/game/world'
import type { CameraPose } from './shots'

/** Unit view direction for a yaw (radians clockwise from north) and pitch (radians, positive up). */
export function viewDirection(yaw: number, pitch: number, out: Vector3): Vector3 {
  const level = Math.cos(pitch)
  return out.set(Math.sin(yaw) * level, Math.sin(pitch), -Math.cos(yaw) * level)
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

/**
 * Third person: orbit a point above the shoulders, over the right shoulder. A sphere swept from
 * that point keeps the camera in front of terrain and rocks.
 */
export function thirdPersonPose(
  state: FollowState,
  feet: Vec3,
  yaw: number,
  pitch: number,
  dt: number,
  cast: ProbeCast,
  terrain: Terrain,
  out: CameraPose,
): CameraPose {
  const c = CAMERA.thirdPerson
  // Tight horizontally so the view never feels delayed; softer vertically so jumps and landings don't jolt it.
  const follow = state.ready ? 1 - Math.exp(-c.followSharpness * dt) : 1
  const rise = state.ready ? 1 - Math.exp(-c.verticalSharpness * dt) : 1
  state.pivot.x += (feet.x - state.pivot.x) * follow
  state.pivot.z += (feet.z - state.pivot.z) * follow
  state.pivot.y += (feet.y + c.pivotHeight - state.pivot.y) * rise

  viewDirection(yaw, pitch, view)
  boom.set(Math.cos(yaw) * c.shoulderOffset, 0, Math.sin(yaw) * c.shoulderOffset).addScaledVector(view, -c.distance)
  const reach = boom.length()
  boom.divideScalar(reach)
  const clear = Math.max(0.2, cast(state.pivot, boom, reach) - c.collisionMargin)
  // Pull in at once when something gets in the way; ease back out once it clears.
  if (!state.ready || clear < state.distance) state.distance = clear
  else state.distance += (clear - state.distance) * (1 - Math.exp(-c.zoomOutSharpness * dt))
  state.ready = true

  out.position.copy(state.pivot).addScaledVector(boom, state.distance)
  // Beyond the playable area there is no collider, so also keep above the exact terrain.
  const floor = terrain.heightAt(out.position.x, out.position.z) + c.groundClearance
  if (out.position.y < floor) out.position.y = floor
  out.target.copy(out.position).addScaledVector(view, 10)
  return out
}

/** First person: at eye level inside the helmet, looking where the mouse points. */
export function firstPersonPose(feet: Vec3, yaw: number, pitch: number, out: CameraPose): CameraPose {
  viewDirection(yaw, pitch, view)
  out.position.set(feet.x, feet.y + CAMERA.firstPerson.eyeHeight, feet.z)
  out.target.copy(out.position).addScaledVector(view, 10)
  return out
}
