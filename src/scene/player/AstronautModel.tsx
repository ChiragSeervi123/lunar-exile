import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MeshBasicMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { RENDER_LAYERS } from '@/config/graphics'
import { PLAYER_CONTROLLER } from '@/config/player'
import { PLAYER_BASE } from '@/data/player'
import { LANDING_TIME, resolveAnimationState, wrapAngle } from '@/game/player'
import { toLocal, type Planet } from '@/game/planet'
import { cameraRuntime, miningRuntime, playerAnimation, playerMotion, playerRuntime } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { clamp, directionFromAngles } from '@/utils/math'
import { normalize, vec3 } from '@/utils/vec3'
import { createAstronautParts, RIG } from './astronautGeometry'
import { createPose, POSE_KEYS, STRIDE, targetPose } from './astronautPose'
import { createLensGeometry, createMiningToolGeometry, LENS_FIRING, LENS_IDLE, TOOL_TIP } from './toolGeometry'

/** Shoulder height above the feet, for aiming the tool arm. */
const SHOULDER_HEIGHT = RIG.pelvisHeight + RIG.waist + RIG.shoulder[1]

/** How quickly joints blend toward the target pose (higher is snappier). */
const POSE_SHARPNESS = 13
const TURN_SHARPNESS = 20

interface AstronautModelProps {
  region: RegionDef
  planet: Planet
}

/**
 * Procedural low-poly astronaut holding its mining tool, animated from the player's physics and
 * mining state. Swap this component for a skinned GLTF model later: it only reads playerRuntime,
 * playerMotion, cameraRuntime and miningRuntime, and writes the tool's emitter position back.
 */
export function AstronautModel({ region, planet }: AstronautModelProps) {
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
  const tool = useMemo(
    () => ({
      geometry: createMiningToolGeometry(),
      lens: createLensGeometry(),
      glow: new MeshBasicMaterial({ color: LENS_IDLE, toneMapped: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      tool.geometry.dispose()
      tool.lens.dispose()
      tool.glow.dispose()
    },
    [tool],
  )

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
  const lens = useRef<Mesh>(null)
  const tip = useRef<Object3D>(null)
  const anim = useRef({
    pose: createPose(),
    target: createPose(),
    gait: 0,
    yaw: playerRuntime.facing,
    hidden: false,
    tip: new Vector3(),
    up: vec3(),
    normal: vec3(),
    local: vec3(),
  })

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
      // The ground's slope in the body's frame (x east, y up, z south), as on the flat map.
      planet.normalAt(normalize(a.up, playerRuntime.renderPosition), a.normal)
      const { x: nx, y: ny, z: nz } = toLocal(playerRuntime.renderFrame, a.normal, a.local)
      const rise = -(nx * Math.sin(a.yaw) - nz * Math.cos(a.yaw)) / Math.max(ny, 0.2)
      a.target.lean += clamp(rise * 0.35, -0.12, 0.18)
    }
    // Mining: point the tool arm at the target (the body already faces it) and brace with the other.
    const firing = miningRuntime.mining
    if (firing) {
      const p = playerRuntime.renderPosition
      const t = miningRuntime.point
      // Where the target is, in the body's frame.
      a.normal.x = t.x - p.x
      a.normal.y = t.y - p.y
      a.normal.z = t.z - p.z
      const d = toLocal(playerRuntime.renderFrame, a.normal, a.local)
      const elevation = Math.atan2(d.y - SHOULDER_HEIGHT, Math.hypot(d.x, d.z))
      a.target.shoulderR = clamp(Math.PI / 2 + elevation, 0.2, 2.8) + 0.025 * Math.sin(state.clock.elapsedTime * 45)
      a.target.elbowR = 0.08
      a.target.shoulderL = Math.max(a.target.shoulderL, 0.35)
      a.target.elbowL = Math.max(a.target.elbowL, 0.75)
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

    const lensMaterial = lens.current?.material as MeshBasicMaterial | undefined
    if (lensMaterial) {
      if (firing) lensMaterial.color.copy(LENS_IDLE).lerp(LENS_FIRING, 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 47))
      else lensMaterial.color.copy(LENS_IDLE)
    }
    // The beam leaves this tool unless the first-person view shows its own.
    if (!a.hidden && tip.current) {
      tip.current.getWorldPosition(a.tip)
      miningRuntime.toolTip.x = a.tip.x
      miningRuntime.toolTip.y = a.tip.y
      miningRuntime.toolTip.z = a.tip.z
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
              {/* The mining tool in the right glove, pointing along the forearm. */}
              <group position={[0, -0.32, -0.04]} rotation-x={-Math.PI / 2}>
                <mesh geometry={tool.geometry} material={suit} castShadow receiveShadow />
                <mesh ref={lens} geometry={tool.lens} material={tool.glow} />
                <object3D ref={tip} position={TOOL_TIP} />
              </group>
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
