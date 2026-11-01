import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { RENDER_LAYERS } from '@/config/graphics'
import { PLAYER_CONTROLLER } from '@/config/player'
import { PLAYER_BASE } from '@/data/player'
import { LANDING_TIME, resolveAnimationState, wrapAngle } from '@/game/player'
import type { Terrain } from '@/game/world'
import { cameraRuntime, playerAnimation, playerMotion, playerRuntime } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { clamp, directionFromAngles } from '@/utils/math'
import { createAstronautParts, RIG } from './astronautGeometry'
import { createPose, POSE_KEYS, STRIDE, targetPose } from './astronautPose'

/** How quickly joints blend toward the target pose (higher is snappier). */
const POSE_SHARPNESS = 13
const TURN_SHARPNESS = 20

interface AstronautModelProps {
  region: RegionDef
  terrain: Terrain
}

/**
 * Procedural low-poly astronaut, animated from the player's physics state. Swap this component
 * for a skinned GLTF model later: it only reads playerRuntime, playerMotion and cameraRuntime.
 */
export function AstronautModel({ region, terrain }: AstronautModelProps) {
  const { sun, earth } = region.sky
  const parts = useMemo(
    () =>
      createAstronautParts(
        directionFromAngles(sun.azimuth, sun.elevation),
        earth ? directionFromAngles(earth.azimuth, earth.elevation) : null,
      ),
    [sun, earth],
  )
  useEffect(() => () => parts.dispose(), [parts])

  const root = useRef<Group>(null)
  const pelvis = useRef<Group>(null)
  const torso = useRef<Group>(null)
  const head = useRef<Group>(null)
  const shoulderL = useRef<Group>(null)
  const shoulderR = useRef<Group>(null)
  const elbowL = useRef<Group>(null)
  const elbowR = useRef<Group>(null)
  const hipL = useRef<Group>(null)
  const hipR = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const kneeR = useRef<Group>(null)
  const anim = useRef({ pose: createPose(), target: createPose(), gait: 0, yaw: playerRuntime.facing, hidden: false })

  useFrame((state, delta) => {
    const a = anim.current
    const dt = Math.min(delta, 0.1)
    const body = root.current
    if (!body) return

    // Turn smoothly toward the physics facing, which updates at the physics rate.
    a.yaw = wrapAngle(a.yaw + wrapAngle(playerRuntime.facing - a.yaw) * (1 - Math.exp(-TURN_SHARPNESS * dt)))
    body.rotation.y = -a.yaw

    const speed = Math.hypot(playerMotion.velocity.x, playerMotion.velocity.z)
    const current = resolveAnimationState(
      {
        grounded: playerMotion.grounded,
        airTime: playerMotion.airTime,
        verticalSpeed: playerMotion.velocity.y,
        horizontalSpeed: speed,
        sprinting: playerMotion.sprinting,
        timeSinceLanding: playerMotion.timeSinceLanding,
        landingSpeed: playerMotion.landingSpeed,
      },
      PLAYER_BASE.walkSpeed,
      PLAYER_CONTROLLER.hardLandingSpeed,
    )
    playerAnimation.state = current

    const stride = STRIDE[current]
    if (stride) a.gait = (a.gait + ((speed * dt) / stride) * Math.PI * 2) % (Math.PI * 2)
    const impact = clamp((playerMotion.landingSpeed - 1.5) / 3, 0, 1)
    const landing = impact * (1 - clamp(playerMotion.timeSinceLanding / LANDING_TIME, 0, 1))
    targetPose(current, a.gait, state.clock.elapsedTime, landing, a.target)
    // Lean into the slope: forward walking uphill, back walking downhill.
    if (playerMotion.grounded && speed > 0.5) {
      const [nx, ny, nz] = terrain.normalAt(playerRuntime.renderPosition.x, playerRuntime.renderPosition.z)
      const rise = -(nx * Math.sin(a.yaw) - nz * Math.cos(a.yaw)) / Math.max(ny, 0.2)
      a.target.lean += clamp(rise * 0.35, -0.12, 0.18)
    }

    const blend = 1 - Math.exp(-POSE_SHARPNESS * dt)
    for (const key of POSE_KEYS) a.pose[key] += (a.target[key] - a.pose[key]) * blend
    const p = a.pose
    pelvis.current?.position.setY(RIG.pelvisHeight + p.bodyY)
    torso.current?.rotation.set(-p.lean, 0, 0)
    head.current?.rotation.set(p.headPitch, 0, 0)
    shoulderL.current?.rotation.set(p.shoulderL, 0, -p.armOut)
    shoulderR.current?.rotation.set(p.shoulderR, 0, p.armOut)
    elbowL.current?.rotation.set(p.elbowL, 0, 0)
    elbowR.current?.rotation.set(p.elbowR, 0, 0)
    hipL.current?.rotation.set(p.hipL, 0, 0)
    hipR.current?.rotation.set(p.hipR, 0, 0)
    kneeL.current?.rotation.set(-p.kneeL, 0, 0)
    kneeR.current?.rotation.set(-p.kneeR, 0, 0)

    // With the camera inside the helmet, keep drawing the body into shadows but not on screen.
    if (cameraRuntime.bodyHidden !== a.hidden) {
      a.hidden = cameraRuntime.bodyHidden
      const layer = a.hidden ? RENDER_LAYERS.shadowOnly : 0
      body.traverse((object) => object.layers.set(layer))
    }
  }, FRAME_PRIORITY.player)

  const { geometry: g, suit, visor } = parts
  const [hipX, hipY] = RIG.hip
  const [shoulderX, shoulderY] = RIG.shoulder
  return (
    <group ref={root}>
      <group ref={pelvis} position-y={RIG.pelvisHeight}>
        <mesh geometry={g.pelvis} material={suit} castShadow receiveShadow />
        <group ref={torso} position-y={RIG.waist}>
          <mesh geometry={g.torso} material={suit} castShadow receiveShadow />
          <group ref={head} position-y={RIG.neck}>
            <mesh geometry={g.helmet} material={suit} castShadow receiveShadow />
            <mesh geometry={g.visor} material={visor} />
          </group>
          <group ref={shoulderL} position={[-shoulderX, shoulderY, 0]}>
            <mesh geometry={g.upperArm} material={suit} castShadow receiveShadow />
            <group ref={elbowL} position-y={-RIG.upperArm}>
              <mesh geometry={g.forearm} material={suit} castShadow receiveShadow />
            </group>
          </group>
          <group ref={shoulderR} position={[shoulderX, shoulderY, 0]}>
            <mesh geometry={g.upperArm} material={suit} castShadow receiveShadow />
            <group ref={elbowR} position-y={-RIG.upperArm}>
              <mesh geometry={g.forearm} material={suit} castShadow receiveShadow />
            </group>
          </group>
        </group>
        <group ref={hipL} position={[-hipX, hipY, 0]}>
          <mesh geometry={g.thigh} material={suit} castShadow receiveShadow />
          <group ref={kneeL} position-y={-RIG.thigh}>
            <mesh geometry={g.shin} material={suit} castShadow receiveShadow />
          </group>
        </group>
        <group ref={hipR} position={[hipX, hipY, 0]}>
          <mesh geometry={g.thigh} material={suit} castShadow receiveShadow />
          <group ref={kneeR} position-y={-RIG.thigh}>
            <mesh geometry={g.shin} material={suit} castShadow receiveShadow />
          </group>
        </group>
      </group>
    </group>
  )
}
