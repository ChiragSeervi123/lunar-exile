import { useRapier } from '@react-three/rapier'
import { useEffect, useMemo } from 'react'
import { Group, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three'
import { COLLISION } from '@/config/game'
import { createFrame, frameFacing, frameRotation, getDiscoverySites, getPlanet, type StructureKind } from '@/game/planet'
import { quat, vec3 } from '@/utils/vec3'
import { box, cylinder, part, segment } from '../lowPoly'
import { withPlanetShadow } from '../planet/planetShadow'

const STONE = '#17181c'
const FUSED = '#8d887d'
const GLOW = '#7fe9ff'

interface Model {
  body: BufferGeometry
  glow: BufferGeometry
  /** Collision boxes in the model's frame: centre, half extents. */
  boxes: { at: [number, number, number]; half: [number, number, number] }[]
}

/** Low-poly alien structures, made of primitives like everything else, with a few glowing parts. */
function buildModel(kind: StructureKind): Model {
  if (kind === 'monolith') {
    return {
      body: segment([part(box(2.2, 9, 0.8), STONE, [0, 4.5, 0]), part(box(3.4, 0.6, 1.8), STONE, [0, 0.3, 0])]),
      glow: segment([part(box(0.08, 7.6, 0.84), GLOW, [0, 4.6, 0]), part(box(1.4, 0.08, 0.84), GLOW, [0, 8.2, 0])]),
      boxes: [{ at: [0, 4.5, 0], half: [1.1, 4.5, 0.4] }],
    }
  }
  if (kind === 'arch') {
    return {
      body: segment([
        part(box(1.8, 7.5, 1.8), FUSED, [-4.2, 3.75, 0], [0, 0, 0.04]),
        part(box(1.8, 7.5, 1.8), FUSED, [4.2, 3.75, 0], [0, 0, -0.04]),
        part(box(11, 1.7, 2), FUSED, [0, 8.2, 0]),
        part(box(2.6, 0.5, 2.6), FUSED, [-4.2, 0.25, 0]),
        part(box(2.6, 0.5, 2.6), FUSED, [4.2, 0.25, 0]),
      ]),
      glow: segment([0, 1, 2, 3].map((i) => part(box(0.5, 0.12, 2.04), GLOW, [-2.4 + i * 1.6, 8.2, 0]))),
      boxes: [
        { at: [-4.2, 3.75, 0], half: [0.9, 3.75, 0.9] },
        { at: [4.2, 3.75, 0], half: [0.9, 3.75, 0.9] },
        { at: [0, 8.2, 0], half: [5.5, 0.85, 1] },
      ],
    }
  }
  const count = 7
  const ring = [...Array(count).keys()].map((i) => {
    const a = (i / count) * Math.PI * 2
    return [Math.cos(a) * 7, Math.sin(a) * 7] as const
  })
  return {
    body: segment(ring.map(([x, z], i) => part(cylinder(0.45, 0.7, 4.5 + (i % 3) * 0.8, 6), STONE, [x, (4.5 + (i % 3) * 0.8) / 2, z]))),
    glow: segment(ring.map(([x, z], i) => part(cylinder(0.3, 0.45, 0.5, 6), GLOW, [x, 4.5 + (i % 3) * 0.8 + 0.25, z]))),
    boxes: ring.map(([x, z], i) => ({ at: [x, (4.5 + (i % 3) * 0.8) / 2, z] as [number, number, number], half: [0.55, (4.5 + (i % 3) * 0.8) / 2, 0.55] as [number, number, number] })),
  }
}

/** The alien structures across the Moon: few, so all are drawn and solid. Must sit inside <Physics>. */
export function Structures() {
  const { world, rapier } = useRapier()
  const built = useMemo(() => {
    const planet = getPlanet()
    const group = new Group()
    group.name = 'structures'
    const bodyMaterial = withPlanetShadow(new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.2 }))
    const glowMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    const models = new Map<StructureKind, Model>()
    const placements: { model: Model; matrix: Matrix4 }[] = []
    const frame = createFrame()
    const q = quat()
    for (const site of getDiscoverySites()) {
      if (site.kind !== 'structure' || !site.structure) continue
      let model = models.get(site.structure)
      if (!model) models.set(site.structure, (model = buildModel(site.structure)))
      frameFacing(frame, site.dir, vec3(0, 1, 0))
      frameRotation(frame, q)
      const rotation = new Quaternion(q.x, q.y, q.z, q.w).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), site.yaw ?? 0))
      // Sunk a little, so it sits in the ground on any slope.
      const r = planet.surfaceRadius(site.dir) - 0.4
      const position = new Vector3(site.dir.x * r, site.dir.y * r, site.dir.z * r)
      const matrix = new Matrix4().compose(position, rotation, new Vector3(1, 1, 1))
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
      placements.push({ model, matrix })
    }
    return {
      group,
      placements,
      dispose() {
        for (const m of models.values()) {
          m.body.dispose()
          m.glow.dispose()
        }
        bodyMaterial.dispose()
        glowMaterial.dispose()
      },
    }
  }, [])
  useEffect(() => () => built.dispose(), [built])

  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    const position = new Vector3()
    const rotation = new Quaternion()
    const scale = new Vector3()
    const centre = new Vector3()
    for (const { model, matrix } of built.placements) {
      matrix.decompose(position, rotation, scale)
      for (const b of model.boxes) {
        centre.set(...b.at).applyMatrix4(matrix)
        world.createCollider(
          rapier.ColliderDesc.cuboid(...b.half)
            .setTranslation(centre.x, centre.y, centre.z)
            .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
            .setCollisionGroups(COLLISION.obstacles),
          body,
        )
      }
    }
    return () => {
      // <Physics> cleans up first and may already have freed the world; only remove our own body.
      if (world.getRigidBody(body.handle) === body) world.removeRigidBody(body)
    }
  }, [world, rapier, built])

  return <primitive object={built.group} />
}
