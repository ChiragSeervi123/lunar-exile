import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import { Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three'
import { COLLISION, FRAME_PRIORITY } from '@/config/game'
import { LANDER } from '@/config/trade'
import { chartDirection, chartRotation, getPlanet, toLocal } from '@/game/planet'
import { inputState } from '@/input/inputState'
import { useGameStore } from '@/stores/gameStore'
import { playerRuntime } from '@/stores/runtime'
import { tradeRuntime, useTradeStore } from '@/stores/tradeStore'
import { quat, vec3 } from '@/utils/vec3'
import { box, cylinder, part, segment } from '../lowPoly'
import { withPlanetShadow } from '../planet/planetShadow'

const HULL = '#c9ccd2'
const DARK = '#2a2d33'
const FOIL = '#c8a24a'
const STRUT = '#8b8f97'
const SCREEN = '#ffc56b'
const BEACON = '#ff8a3d'

/** Height of the astronaut's chest above the feet, for reaching the terminal, meters. */
const CHEST = 1.2

interface Model {
  body: BufferGeometry
  glow: BufferGeometry
  /** Collision boxes in the lander's frame: centre, half extents. */
  boxes: { at: [number, number, number]; half: [number, number, number] }[]
}

/** The Scout Lander, low-poly: hull on four legs, foil band, antenna, beacon, and a terminal in front. */
function buildModel(): Model {
  const [tx, ty, tz] = LANDER.terminal
  const legs = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].flatMap(([sx, sz]) => [
    part(box(0.22, 2.9, 0.22), STRUT, [sx * 2.35, 1.35, sz * 2.35], [sz * 0.32, 0, -sx * 0.32]),
    part(cylinder(0.5, 0.58, 0.14, 6), DARK, [sx * 2.85, 0.07, sz * 2.85]),
  ])
  return {
    body: segment([
      part(cylinder(1.9, 2.3, 2.2, 8), HULL, [0, 2.9, 0]),
      part(cylinder(2.32, 2.32, 0.45, 8), FOIL, [0, 1.95, 0]),
      part(cylinder(0.9, 1.9, 1.0, 8), HULL, [0, 4.5, 0]),
      part(cylinder(0.06, 0.06, 1.5, 4), STRUT, [0.6, 5.6, 0.3]),
      part(cylinder(0.45, 0.05, 0.25, 6), STRUT, [0.6, 6.3, 0.3], [0.5, 0, 0]),
      part(box(1.1, 0.9, 0.12), DARK, [0, 2.8, -2.08]),
      ...legs,
      // The terminal: a post with a slanted console facing the arrival point.
      part(box(0.5, ty + 0.2, 0.4), DARK, [tx, (ty + 0.2) / 2 - 0.1, tz + 0.15]),
      part(box(1.0, 0.7, 0.16), DARK, [tx, ty + 0.25, tz], [-0.45, 0, 0]),
    ]),
    glow: segment([
      part(box(0.82, 0.5, 0.04), SCREEN, [tx, ty + 0.27, tz - 0.085], [-0.45, 0, 0]),
      part(cylinder(0.16, 0.16, 0.3, 6), BEACON, [0, 5.15, 0]),
      part(box(0.9, 0.08, 0.14), SCREEN, [0, 3.35, -2.1]),
    ]),
    boxes: [
      { at: [0, 2.6, 0], half: [2.2, 2.6, 2.2] },
      { at: [tx, ty / 2, tz + 0.1], half: [0.5, ty / 2 + 0.2, 0.3] },
    ],
  }
}

/**
 * The Scout Lander at the landing site, with the trade terminal the astronaut uses with the
 * interact key. Solid; its beacon pulses so it can be found. Must sit inside <Physics>.
 */
export function Lander() {
  const { world, rapier } = useRapier()
  const { gl, scene, camera } = useThree()
  const built = useMemo(() => {
    const planet = getPlanet()
    const R = planet.radius
    const dir = chartDirection(LANDER.x, LANDER.z, R, vec3())
    // Facing the arrival point at the map's origin: yaw clockwise from north.
    const yaw = Math.atan2(-LANDER.x, LANDER.z)
    const q = chartRotation(LANDER.x, LANDER.z, R, quat())
    const rotation = new Quaternion(q.x, q.y, q.z, q.w).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -yaw))
    const r = planet.surfaceRadius(dir) - 0.12
    const position = new Vector3(dir.x * r, dir.y * r, dir.z * r)
    const matrix = new Matrix4().compose(position, rotation, new Vector3(1, 1, 1))
    const model = buildModel()
    const bodyMaterial = withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.25 }))
    const glowMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const group = new Group()
    group.name = 'lander'
    for (const [geometry, material, shadow] of [
      [model.body, bodyMaterial, true],
      [model.glow, glowMaterial, false],
    ] as const) {
      const mesh = new Mesh(geometry, material)
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(matrix)
      mesh.castShadow = shadow
      mesh.receiveShadow = true
      group.add(mesh)
    }
    const terminal = new Vector3(...LANDER.terminal).applyMatrix4(matrix)
    return {
      group,
      model,
      matrix,
      rotation,
      position,
      terminal: vec3(terminal.x, terminal.y, terminal.z),
      glowMaterial,
      dispose() {
        model.body.dispose()
        model.glow.dispose()
        bodyMaterial.dispose()
        glowMaterial.dispose()
      },
    }
  }, [])
  useEffect(() => () => built.dispose(), [built])

  // Its shaders compile now, not the first time the astronaut turns round to look at it.
  useEffect(() => {
    gl.compile(built.group, camera, scene)
  }, [gl, scene, camera, built])

  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    const centre = new Vector3()
    const { rotation } = built
    for (const b of built.model.boxes) {
      centre.set(...b.at).applyMatrix4(built.matrix)
      world.createCollider(
        rapier.ColliderDesc.cuboid(...b.half)
          .setTranslation(centre.x, centre.y, centre.z)
          .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
          .setCollisionGroups(COLLISION.obstacles),
        body,
      )
    }
    return () => {
      // <Physics> cleans up first and may already have freed the world; only remove our own body.
      if (world.getRigidBody(body.handle) === body) world.removeRigidBody(body)
    }
  }, [world, rapier, built])

  const scratch = useMemo(() => ({ chest: vec3(), local: vec3() }), [])
  // Before the mining system, which would otherwise take the interact press.
  useFrame(({ clock }) => {
    built.glowMaterial.color.setScalar(0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.4))
    const phase = useGameStore.getState().phase
    let near = false
    if (playerRuntime.active) {
      const p = playerRuntime.position
      const f = playerRuntime.frame
      const { chest, local } = scratch
      chest.x = p.x + f.up.x * CHEST
      chest.y = p.y + f.up.y * CHEST
      chest.z = p.z + f.up.z * CHEST
      const t = built.terminal
      near = phase === 'playing' && Math.hypot(t.x - chest.x, t.y - chest.y, t.z - chest.z) < LANDER.reach
      const l = built.position
      tradeRuntime.distance = Math.hypot(l.x - p.x, l.y - p.y, l.z - p.z)
      toLocal(f, vec3(l.x - p.x, l.y - p.y, l.z - p.z), local)
      tradeRuntime.bearing = Math.atan2(local.x, -local.z)
      if (near && inputState.interactQueued) {
        inputState.interactQueued = false
        useTradeStore.getState().requestOpen()
      }
    } else tradeRuntime.distance = Number.POSITIVE_INFINITY
    if (near !== useTradeStore.getState().near) useTradeStore.setState({ near })
  }, FRAME_PRIORITY.interaction - 1)

  return <primitive object={built.group} />
}
