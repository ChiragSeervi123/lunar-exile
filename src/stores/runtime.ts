import type { Deposit } from '@/game/mining'
import { copyFrame, createFrame, type Frame } from '@/game/planet/frame'
import type { AnimationState, Vec3 } from '@/game/player'
import type { TargetKind } from './miningStore'

/*
 * Transient per-frame state shared between systems. Written inside physics steps and useFrame
 * callbacks, read by the camera, animation, lighting and save system. Mutated in place to avoid
 * allocations and React re-renders: never read during render, never serialised directly.
 */

/** Where the player body is. Positions are world space, with the Moon's centre at the origin. */
export const playerRuntime = {
  /** A player body exists in the scene. */
  active: false,
  /** Feet position after the last physics step. */
  position: { x: 0, y: 0, z: 0 } as Vec3,
  /** Feet position interpolated for the current frame, for the camera, shadows and effects. */
  renderPosition: { x: 0, y: 0, z: 0 } as Vec3,
  /**
   * The body's local frame (up away from the Moon's centre, east, north), carried along the ground
   * by the physics steps. Yaw angles (the body's and the camera's) are measured in it.
   */
  frame: createFrame(),
  /** The same frame at the render position, for the camera, the astronaut model and lighting. */
  renderFrame: createFrame(),
  /** Body yaw, radians clockwise from the frame's north. */
  facing: 0,
  /** Feet position (world space) to move the body to at the next physics step (debug tools); null when none. */
  teleport: null as Vec3 | null,
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
  /** Radians clockwise from north in the player's frame (playerRuntime.frame). */
  yaw: 0,
  /** Radians above the local horizontal; positive looks up. */
  pitch: 0,
  position: { x: 0, y: 0, z: 0 } as Vec3,
  /** The camera is inside or right next to the helmet, so the body is hidden from it. */
  bodyHidden: false,
  /** A fixed view set by the debug tools, overriding the camera rig; null in normal play. */
  override: null as { position: Vec3; target: Vec3; up: Vec3 } | null,
}

/** Something the effects should show once: a deposit breaking, or its ore being picked up. */
export interface MiningEvent {
  type: 'break' | 'collect'
  deposit: Deposit
}

/** Aiming and mining, shared by the mining system, tool models, effects and HUD. */
export const miningRuntime = {
  /** Deposit (or its ore on the ground) under the crosshair, or null. */
  target: null as Deposit | null,
  targetKind: 'deposit' as TargetKind,
  /** Where the aim ray meets the target, world space. */
  point: { x: 0, y: 0, z: 0 } as Vec3,
  /** From the astronaut's chest to that point, meters. */
  distance: 0,
  inRange: false,
  /** The beam is on and cutting the target this frame. */
  mining: false,
  /** The beam is digging into a cave wall (at `point`) this frame. */
  digging: false,
  /** Remaining health of damaged deposits by id; untouched deposits have no entry. Never saved. */
  health: new Map<string, number>(),
  /** World position of the visible tool's emitter, written by the tool models every frame. */
  toolTip: { x: 0, y: 0, z: 0 } as Vec3,
  /** Camera shake trauma, 0..1; the shake grows with its square. */
  shake: 0,
  /** One-off events for the effects, drained by them every frame. */
  events: [] as MiningEvent[],
}

/** World clock for the current save. */
export const worldRuntime = {
  /** Seconds played in this save, menus and pause excluded. Deposits regrow on this clock. */
  playTime: 0,
}

/** Clears aiming, damage and pending effects, e.g. when a different save is loaded. */
export function resetMining(): void {
  miningRuntime.target = null
  miningRuntime.inRange = false
  miningRuntime.mining = false
  miningRuntime.digging = false
  miningRuntime.health.clear()
  miningRuntime.shake = 0
  miningRuntime.events.length = 0
}

/** A body now stands at `feet` (world space) with `frame` and `facing`; the motion state starts at rest. */
export function placePlayer(feet: Vec3, frame: Frame, facing: number): void {
  playerRuntime.active = true
  playerRuntime.position = { x: feet.x, y: feet.y, z: feet.z }
  playerRuntime.renderPosition = { x: feet.x, y: feet.y, z: feet.z }
  copyFrame(playerRuntime.frame, frame)
  copyFrame(playerRuntime.renderFrame, frame)
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
  playerRuntime.teleport = null
  cameraRuntime.bodyHidden = false
}
