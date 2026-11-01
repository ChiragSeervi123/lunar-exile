import { useFrame } from '@react-three/fiber'
import {
  CapsuleCollider,
  RigidBody,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier'
import { useEffect, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import { CAMERA } from '@/config/camera'
import { COLLISION, FRAME_PRIORITY } from '@/config/game'
import { PLAYER_CONTROLLER } from '@/config/player'
import { createMotorInput, createMotorState, defaultFacing, type MotorState } from '@/game/player'
import type { Terrain } from '@/game/world'
import { axis, inputState, isHeld } from '@/input/inputState'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, miningRuntime, placePlayer, playerMotion, playerRuntime, removePlayer } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { DEG2RAD } from '@/utils/math'
import { AstronautModel } from './AstronautModel'
import { BODY_CENTER, createPlayerController, findSpawn, type PlayerController } from './playerController'

interface PlayerProps {
  region: RegionDef
  terrain: Terrain
}

/**
 * The playable astronaut: a kinematic capsule moved every fixed physics step by the character
 * controller, with the procedural model riding on it. Spawns at the saved position or the landing
 * zone. Must sit inside <Physics>.
 */
export function Player({ region, terrain }: PlayerProps) {
  const { world, rapier } = useRapier()
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null)
  const [spawn] = useState(() =>
    findSpawn(world, rapier, terrain, usePlayerStore.getState().spawnPoint, defaultFacing(region)),
  )
  const controller = useRef<PlayerController | null>(null)
  const motor = useRef<MotorState | null>(null)
  const input = useRef(createMotorInput())
  const feet = useRef({ x: spawn.x, y: spawn.y, z: spawn.z })
  const worldPosition = useRef(new Vector3())

  useEffect(() => {
    controller.current = createPlayerController(world, terrain, rapier.QueryFilterFlags.EXCLUDE_SENSORS)
    motor.current = createMotorState(spawn.facing)
    placePlayer(spawn.x, spawn.y, spawn.z, spawn.facing)
    // Start behind the astronaut, looking the way it faces.
    cameraRuntime.yaw = spawn.facing
    cameraRuntime.pitch = CAMERA.thirdPerson.startPitch * DEG2RAD
    return () => {
      controller.current?.dispose()
      controller.current = null
      removePlayer()
    }
  }, [world, rapier, terrain, spawn])

  useBeforePhysicsStep((physics) => {
    const b = body.current
    const c = collider.current
    const ctl = controller.current
    const m = motor.current
    if (!b || !c || !ctl || !m) return
    // A requested move (debug tools) places the body on the first surface at the new spot.
    const warp = playerRuntime.teleport
    if (warp) {
      playerRuntime.teleport = null
      const ground = terrain.heightAt(warp.x, warp.z)
      const spot = findSpawn(world, rapier, terrain, { position: [warp.x, ground, warp.z], facing: m.facing }, m.facing)
      const center = { x: spot.x, y: spot.y + BODY_CENTER, z: spot.z }
      b.setTranslation(center, true)
      b.setNextKinematicTranslation(center)
      feet.current = { x: spot.x, y: spot.y, z: spot.z }
      motor.current = createMotorState(m.facing)
      placePlayer(spot.x, spot.y, spot.z, m.facing)
      return
    }
    const i = input.current
    i.forward = axis('moveForward', 'moveBack')
    i.strafe = axis('moveRight', 'moveLeft')
    i.sprint = isHeld('sprint')
    i.jump = inputState.jumpQueued
    inputState.jumpQueued = false
    i.viewYaw = cameraRuntime.yaw
    // Face where the camera looks in first person, and while mining so the tool points at the target.
    i.faceView = usePlayerStore.getState().cameraMode === 'first-person' || miningRuntime.mining

    const dt = physics.timestep
    const impact = ctl.step(b, c, m, i, dt, feet.current)

    playerRuntime.position.x = feet.current.x
    playerRuntime.position.y = feet.current.y
    playerRuntime.position.z = feet.current.z
    playerRuntime.facing = m.facing
    playerMotion.velocity.x = m.velocity.x
    playerMotion.velocity.y = m.velocity.y
    playerMotion.velocity.z = m.velocity.z
    playerMotion.grounded = m.grounded
    playerMotion.airTime = m.airTime
    playerMotion.sprinting = m.sprinting
    if (impact > 0) {
      playerMotion.landingSpeed = impact
      playerMotion.timeSinceLanding = 0
    } else playerMotion.timeSinceLanding += dt
  })

  // After the physics frame: publish the interpolated position for the camera, shadows and effects.
  useFrame(() => {
    const v = visual.current
    if (!v) return
    v.getWorldPosition(worldPosition.current)
    playerRuntime.renderPosition.x = worldPosition.current.x
    playerRuntime.renderPosition.y = worldPosition.current.y
    playerRuntime.renderPosition.z = worldPosition.current.z
  }, FRAME_PRIORITY.player)

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[spawn.x, spawn.y + BODY_CENTER, spawn.z]}
    >
      <CapsuleCollider
        ref={collider}
        args={[PLAYER_CONTROLLER.halfHeight, PLAYER_CONTROLLER.radius]}
        collisionGroups={COLLISION.player}
      />
      <group ref={visual} position-y={-BODY_CENTER}>
        <AstronautModel region={region} terrain={terrain} />
      </group>
    </RigidBody>
  )
}
