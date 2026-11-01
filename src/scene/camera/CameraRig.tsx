import { PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import { CAMERA } from '@/config/camera'
import type { Terrain } from '@/game/world'
import { useGameStore } from '@/stores/gameStore'
import type { RegionDef } from '@/types/content'
import { clamp, easeInOutCubic } from '@/utils/math'
import { createPose, createShots, type CameraPose, type ShotName } from './shots'

interface CameraRigProps {
  region: RegionDef
  terrain: Terrain
}

/**
 * Owns the camera: the menu pan, the establishing shot when a game starts, and smooth arcing
 * transitions between them. Player-follow modes join here in Milestone 2.
 */
export function CameraRig({ region, terrain }: CameraRigProps) {
  const cameraRef = useRef<PerspectiveCameraImpl>(null)
  const shot: ShotName = useGameStore((s) => (s.phase === 'menu' ? 'menu' : 'intro'))
  const shots = useMemo(() => createShots(region, terrain), [region, terrain])
  const motion = useRef({
    shot: null as ShotName | null,
    goal: createPose(),
    from: createPose(),
    look: createPose().target,
    start: 0,
    transitioning: false,
  })

  useFrame((state) => {
    const camera = cameraRef.current
    if (!camera) return
    const m = motion.current
    const time = state.clock.elapsedTime
    const goal: CameraPose = shots[shot](time, state.size.width / Math.max(1, state.size.height), m.goal)

    if (m.shot === null) {
      camera.position.copy(goal.position)
      m.look.copy(goal.target)
    } else if (m.shot !== shot) {
      m.from.position.copy(camera.position)
      m.from.target.copy(m.look)
      m.start = time
      m.transitioning = true
    }
    m.shot = shot

    if (m.transitioning) {
      const t = clamp((time - m.start) / CAMERA.transitionSeconds, 0, 1)
      const eased = easeInOutCubic(t)
      camera.position.lerpVectors(m.from.position, goal.position, eased)
      camera.position.y += Math.sin(Math.PI * eased) * CAMERA.transitionArc
      m.look.lerpVectors(m.from.target, goal.target, eased)
      if (t >= 1) m.transitioning = false
    } else {
      camera.position.copy(goal.position)
      m.look.copy(goal.target)
    }

    const ground = terrain.heightAt(camera.position.x, camera.position.z) + CAMERA.groundClearance
    if (camera.position.y < ground) camera.position.y = ground
    camera.lookAt(m.look)
  })

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={CAMERA.cinematicFov} near={CAMERA.near} far={CAMERA.far} />
  )
}
