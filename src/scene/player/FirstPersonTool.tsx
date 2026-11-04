import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { MeshBasicMaterial, MeshStandardMaterial, Vector3, type Group, type Mesh, type Object3D } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { cameraRuntime, miningRuntime, playerMotion, playerRuntime } from '@/stores/runtime'
import { withPlanetShadow } from '../planet/planetShadow'
import {
  createLensGeometry,
  createMiningToolGeometry,
  createViewArmGeometry,
  LENS_FIRING,
  LENS_IDLE,
  TOOL_TIP,
} from './toolGeometry'

/** Where the tool rests in view, in camera space (lower right, beyond the near plane), meters. */
const REST = { x: 0.27, y: -0.25, z: -0.58 }

/**
 * The mining tool in the astronaut's glove, seen from inside the helmet. Lives under the camera,
 * shown only while the body is hidden (first person); it sways with walking and lifts and shakes
 * while the beam fires, which leaves from its emitter.
 */
export function FirstPersonTool() {
  const group = useRef<Group>(null)
  const lens = useRef<Mesh>(null)
  const tip = useRef<Object3D>(null)
  const parts = useMemo(
    () => ({
      tool: createMiningToolGeometry(),
      lens: createLensGeometry(),
      arm: createViewArmGeometry(),
      body: withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.65, metalness: 0.08 })),
      glow: new MeshBasicMaterial({ color: LENS_IDLE, toneMapped: false }),
    }),
    [],
  )
  useEffect(
    () => () => {
      parts.tool.dispose()
      parts.lens.dispose()
      parts.arm.dispose()
      parts.body.dispose()
      parts.glow.dispose()
    },
    [parts],
  )
  const motion = useRef({ raise: 0, stride: 0, tip: new Vector3() })

  // After the camera has moved, so the emitter's world position is this frame's.
  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const visible = cameraRuntime.bodyHidden && playerRuntime.active
    g.visible = visible
    if (!visible) return
    const s = motion.current
    const dt = Math.min(delta, 0.1)
    const firing = miningRuntime.mining
    s.raise += ((firing ? 1 : 0) - s.raise) * (1 - Math.exp(-14 * dt))
    const speed = Math.hypot(playerMotion.velocity.x, playerMotion.velocity.z)
    if (playerMotion.grounded) s.stride += dt * speed * 2.2
    const walk = Math.min(1, speed / 4)
    const tremor = firing ? 0.003 : 0
    g.position.set(
      REST.x - 0.04 * s.raise + Math.sin(s.stride) * 0.012 * walk + (Math.random() - 0.5) * tremor,
      REST.y + 0.035 * s.raise - Math.abs(Math.cos(s.stride)) * 0.012 * walk + (Math.random() - 0.5) * tremor,
      REST.z - 0.05 * s.raise,
    )
    // Angled in toward the centre of the view, where the beam lands.
    g.rotation.set(0.04 + 0.05 * s.raise, 0.1 - 0.05 * s.raise, 0)

    const lensMaterial = lens.current?.material as MeshBasicMaterial | undefined
    if (lensMaterial) {
      if (firing) lensMaterial.color.copy(LENS_IDLE).lerp(LENS_FIRING, 0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 47))
      else lensMaterial.color.copy(LENS_IDLE)
    }
    if (tip.current) {
      tip.current.getWorldPosition(s.tip)
      miningRuntime.toolTip.x = s.tip.x
      miningRuntime.toolTip.y = s.tip.y
      miningRuntime.toolTip.z = s.tip.z
    }
  }, FRAME_PRIORITY.interaction)

  return (
    <group ref={group} visible={false}>
      <mesh geometry={parts.arm} material={parts.body} />
      <mesh geometry={parts.tool} material={parts.body} />
      <mesh ref={lens} geometry={parts.lens} material={parts.glow} />
      <object3D ref={tip} position={TOOL_TIP} />
    </group>
  )
}
