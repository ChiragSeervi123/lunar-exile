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
import { copyFrame, frameDirection, frameRotation, getCaveQueries, transportFrame, type Planet } from '@/game/planet'
import { createMotorInput, createMotorState, defaultFacing, type MotorState, type PlayerPose } from '@/game/player'
import { axis, inputState, isHeld } from '@/input/inputState'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, miningRuntime, placePlayer, playerMotion, playerRuntime, removePlayer } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { DEG2RAD } from '@/utils/math'
import { dot, normalize, quat, vec3 } from '@/utils/vec3'
import { createChunkBuilder } from '../planet/chunkBuilder'
import { COLLISION_TILE_OPTIONS, createTerrainColliders, type TerrainColliders } from '../planet/terrainColliders'
import { planetTerrainStatus } from '../planet/terrainStatus'
import { AstronautModel } from './AstronautModel'
import { BODY_CENTER } from './body'
import { createPlanetController, findPlanetSpawn, type PlanetController, type PlanetPose } from './planetController'

interface PlayerProps {
  region: RegionDef
  planet: Planet
}

/** A saved pose in the controller's terms (the store keeps plain arrays, as saves do). */
function toPose(saved: PlayerPose | null): PlanetPose | null {
  if (!saved) return null
  const [px, py, pz] = saved.position
  const [fx, fy, fz] = saved.forward
  return { position: vec3(px, py, pz), forward: vec3(fx, fy, fz) }
}

interface Simulation {
  controller: PlanetController
  terrain: TerrainColliders
  motor: MotorState
}

/**
 * The playable astronaut on the Moon: a kinematic capsule moved every fixed physics step by the
 * planetary controller, standing upright wherever it is, with the procedural model riding on it.
 * The ground around it is streamed in as collision tiles. Spawns at the saved position or the
 * landing zone. Must sit inside <Physics>.
 */
export function Player({ region, planet }: PlayerProps) {
  const { world, rapier } = useRapier()
  const body = useRef<RapierRigidBody>(null)
  const collider = useRef<RapierCollider>(null)
  const visual = useRef<Group>(null)
  const [spawn] = useState(() => findPlanetSpawn(planet, toPose(usePlayerStore.getState().spawnPoint), defaultFacing(region), getCaveQueries()))
  const [rotation] = useState(() => {
    const q = frameRotation(spawn.frame, quat())
    return [q.x, q.y, q.z, q.w] as [number, number, number, number]
  })
  const sim = useRef<Simulation | null>(null)
  const input = useRef(createMotorInput())
  const feet = useRef(vec3(spawn.feet.x, spawn.feet.y, spawn.feet.z))
  const worldPosition = useRef(new Vector3())
  const scratch = useRef({ up: vec3(), forward: vec3(), view: vec3(), rotation: quat() })

  useEffect(() => {
    // Ground tiles come from their own worker, so they never wait behind the drawn terrain.
    const builder = typeof Worker === 'undefined' ? null : createChunkBuilder(planet, COLLISION_TILE_OPTIONS, 1, 2)
    const terrain = createTerrainColliders(world, rapier, planet, builder)
    terrain.ensure(spawn.feet)
    const controller = createPlanetController(world, planet, rapier.QueryFilterFlags.EXCLUDE_SENSORS, getCaveQueries())
    sim.current = { controller, terrain, motor: createMotorState(spawn.facing) }
    const b = body.current
    if (b) {
      const [x, y, z, w] = rotation
      b.setRotation({ x, y, z, w }, true)
      b.setNextKinematicRotation({ x, y, z, w })
    }
    placePlayer(spawn.feet, spawn.frame, spawn.facing)
    // Start behind the astronaut, looking the way it faces.
    cameraRuntime.yaw = spawn.facing
    cameraRuntime.pitch = CAMERA.thirdPerson.startPitch * DEG2RAD
    return () => {
      controller.dispose()
      terrain.dispose()
      sim.current = null
      planetTerrainStatus.collisionTiles = 0
      removePlayer()
    }
  }, [world, rapier, planet, spawn, rotation])

  useBeforePhysicsStep((physics) => {
    const b = body.current
    const c = collider.current
    const s = sim.current
    if (!b || !c || !s) return
    const frame = playerRuntime.frame
    // A requested move (debug tools): stand on the ground there, still facing the same way.
    const warp = playerRuntime.teleport
    if (warp) {
      playerRuntime.teleport = null
      const forward = frameDirection(frame, s.motor.facing, 0, scratch.current.forward)
      // Keep the camera looking the same way, measured in the new frame.
      const view = frameDirection(frame, cameraRuntime.yaw, 0, scratch.current.view)
      const spot = findPlanetSpawn(planet, { position: warp, forward }, 0, getCaveQueries())
      cameraRuntime.yaw = Math.atan2(dot(view, spot.frame.east), dot(view, spot.frame.north))
      s.terrain.ensure(spot.feet)
      const q = frameRotation(spot.frame, scratch.current.rotation)
      b.setTranslation(spot.center, true)
      b.setNextKinematicTranslation(spot.center)
      b.setRotation(q, true)
      b.setNextKinematicRotation(q)
      feet.current = vec3(spot.feet.x, spot.feet.y, spot.feet.z)
      s.motor = createMotorState(spot.facing)
      s.controller.settle()
      placePlayer(spot.feet, spot.frame, spot.facing)
      return
    }
    s.terrain.update(feet.current)
    planetTerrainStatus.collisionTiles = s.terrain.count

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
    const m = s.motor
    const impact = s.controller.step(b, c, m, i, frame, dt, feet.current)

    playerRuntime.position.x = feet.current.x
    playerRuntime.position.y = feet.current.y
    playerRuntime.position.z = feet.current.z
    playerRuntime.facing = m.facing
    // Velocity in the body's frame (x east, y up, z south), as the animation expects.
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

  // After the physics frame: publish the interpolated position, and the frame there, for the
  // camera, shadows, the model and effects.
  useFrame(() => {
    const v = visual.current
    if (!v) return
    v.getWorldPosition(worldPosition.current)
    const p = playerRuntime.renderPosition
    p.x = worldPosition.current.x
    p.y = worldPosition.current.y
    p.z = worldPosition.current.z
    transportFrame(copyFrame(playerRuntime.renderFrame, playerRuntime.frame), normalize(scratch.current.up, p))
  }, FRAME_PRIORITY.player)

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[spawn.center.x, spawn.center.y, spawn.center.z]}
      quaternion={rotation}
    >
      <CapsuleCollider
        ref={collider}
        args={[PLAYER_CONTROLLER.halfHeight, PLAYER_CONTROLLER.radius]}
        collisionGroups={COLLISION.player}
      />
      <group ref={visual} position-y={-BODY_CENTER}>
        <AstronautModel region={region} planet={planet} />
      </group>
    </RigidBody>
  )
}
