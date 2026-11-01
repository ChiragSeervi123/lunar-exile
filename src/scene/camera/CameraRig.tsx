import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useMemo, useRef, type ReactNode } from 'react'
import { Vector3, type PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import { CAMERA } from '@/config/camera'
import { COLLISION, FRAME_PRIORITY } from '@/config/game'
import { wrapAngle, type CameraMode } from '@/game/player'
import type { Terrain } from '@/game/world'
import { inputState } from '@/input/inputState'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, miningRuntime, playerRuntime } from '@/stores/runtime'
import { useSettingsStore } from '@/stores/settingsStore'
import type { RegionDef } from '@/types/content'
import { clamp, DEG2RAD, easeInOutCubic, lerp } from '@/utils/math'
import { createFollowState, firstPersonPose, thirdPersonPose, type ProbeCast } from './follow'
import { createMenuShot, createPose } from './shots'

type ViewMode = 'menu' | CameraMode

interface CameraRigProps {
  region: RegionDef
  terrain: Terrain
  /** Objects that move with the camera, such as the first-person tool. */
  children?: ReactNode
}

/** Players who ask their system for less motion get no camera shake. */
const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

/**
 * The only camera controller: the menu pan, third- and first-person follow with mouse-look, and
 * smooth blends between them (a long arcing flight between menu and game, a quick blend between
 * the two follow modes). Must sit inside <Physics> for its collision probe.
 */
export function CameraRig({ region, terrain, children }: CameraRigProps) {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const { world, rapier } = useRapier()
  const inMenu = useGameStore((s) => s.phase === 'menu')
  const cameraMode = usePlayerStore((s) => s.cameraMode)
  const mode: ViewMode = inMenu ? 'menu' : cameraMode
  const menuShot = useMemo(() => createMenuShot(region, terrain), [region, terrain])

  const cast = useMemo<ProbeCast>(() => {
    const probe = new rapier.Ball(CAMERA.thirdPerson.collisionRadius)
    const rotation = { x: 0, y: 0, z: 0, w: 1 }
    return (origin, direction, maxDistance) => {
      const hit = world.castShape(origin, rotation, direction, probe, 0, maxDistance, true, undefined, COLLISION.cameraQuery)
      return hit ? hit.time_of_impact : maxDistance
    }
  }, [world, rapier])

  const rig = useRef({
    mode: null as ViewMode | null,
    goal: createPose(),
    from: createPose(),
    look: new Vector3(),
    head: new Vector3(),
    fromFov: CAMERA.fov.menu,
    start: 0,
    duration: 0,
    arc: 0,
    transitioning: false,
    follow: createFollowState(),
  })

  useFrame((state, delta) => {
    const camera = cameraRef.current
    if (!camera) return
    const r = rig.current
    const time = state.clock.elapsedTime
    const dt = Math.min(delta, 0.1)

    // A mode change starts a blend from wherever the camera is right now.
    if (r.mode !== mode) {
      if (r.mode !== null) {
        const flight = r.mode === 'menu' || mode === 'menu'
        r.from.position.copy(camera.position)
        r.from.target.copy(r.look)
        r.fromFov = camera.fov
        r.start = time
        r.duration = flight ? CAMERA.transitionSeconds : CAMERA.modeSwitchSeconds
        r.arc = flight ? CAMERA.transitionArc : 0
        r.transitioning = true
      }
      if (mode === 'third-person') r.follow.ready = false
      r.mode = mode
    }

    const following = mode !== 'menu' && playerRuntime.active
    if (following) {
      const limits = mode === 'first-person' ? CAMERA.firstPerson : CAMERA.thirdPerson
      const turn = CAMERA.mouseRadiansPerPixel * useSettingsStore.getState().mouseSensitivity
      cameraRuntime.yaw = wrapAngle(cameraRuntime.yaw + inputState.lookX * turn)
      cameraRuntime.pitch = clamp(
        cameraRuntime.pitch - inputState.lookY * turn,
        limits.pitchMin * DEG2RAD,
        limits.pitchMax * DEG2RAD,
      )
    }
    inputState.lookX = 0
    inputState.lookY = 0

    const goal = r.goal
    if (mode === 'menu') menuShot(time, state.size.width / Math.max(1, state.size.height), goal)
    else if (!following) {
      // Hold still until the astronaut exists.
      goal.position.copy(camera.position)
      goal.target.copy(r.look)
    } else if (mode === 'third-person') {
      thirdPersonPose(r.follow, playerRuntime.renderPosition, cameraRuntime.yaw, cameraRuntime.pitch, dt, cast, terrain, goal)
    } else firstPersonPose(playerRuntime.renderPosition, cameraRuntime.yaw, cameraRuntime.pitch, goal)

    let fov = CAMERA.fov[mode]
    if (r.transitioning) {
      const t = clamp((time - r.start) / r.duration, 0, 1)
      const eased = easeInOutCubic(t)
      camera.position.lerpVectors(r.from.position, goal.position, eased)
      camera.position.y += Math.sin(Math.PI * eased) * r.arc
      r.look.lerpVectors(r.from.target, goal.target, eased)
      fov = lerp(r.fromFov, fov, eased)
      if (t >= 1) r.transitioning = false
    } else {
      camera.position.copy(goal.position)
      r.look.copy(goal.target)
    }
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // Never dip into the ground, including mid-blend (first person is already at eye height).
    if (mode !== 'first-person' || r.transitioning) {
      const clearance = mode === 'menu' ? CAMERA.groundClearance : CAMERA.thirdPerson.groundClearance
      const ground = terrain.heightAt(camera.position.x, camera.position.z) + clearance
      if (camera.position.y < ground) camera.position.y = ground
    }
    camera.lookAt(r.look)
    // Mining tremble: a small, quickly fading wobble of the view itself, not of where it aims.
    const shake = miningRuntime.shake
    if (following && shake > 0 && !reducedMotion?.matches) {
      const k = shake * shake * CAMERA.shake * 0.5
      camera.rotateX(k * (Math.sin(time * 61) + Math.sin(time * 23.7)))
      camera.rotateY(k * (Math.sin(time * 47.3) + Math.sin(time * 31.1)))
    }

    cameraRuntime.position.x = camera.position.x
    cameraRuntime.position.y = camera.position.y
    cameraRuntime.position.z = camera.position.z
    // At or right next to the helmet, the body would fill the view: hide it from the camera.
    const p = playerRuntime.renderPosition
    r.head.set(p.x, p.y + CAMERA.firstPerson.eyeHeight, p.z)
    cameraRuntime.bodyHidden = following && camera.position.distanceTo(r.head) < CAMERA.hideBodyDistance
  }, FRAME_PRIORITY.camera)

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={CAMERA.fov.menu} near={CAMERA.near} far={CAMERA.far}>
      {children}
    </PerspectiveCamera>
  )
}
