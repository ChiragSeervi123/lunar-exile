import {
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three'
import { getItem } from '@/data/items'
import { RESOURCES, getResource } from '@/data/resources'
import { DEPOSIT_BOUNDS, type Deposit, type DepositSites } from '@/game/mining'
import { miningRuntime } from '@/stores/runtime'
import type { ResourceDef } from '@/types/content'
import { clamp } from '@/utils/math'
import { withPlanetShadow } from '../planet/planetShadow'
import { createDepositGeometry, createHaloGeometry, createOreGeometry } from './depositGeometry'
import { createDepositMaterial, createHaloMaterial, createOreMaterial } from './depositMaterials'
import { depositRotation, depositUp } from './depositPose'

/** Seconds for a broken deposit to crumble away, and for a regrown one to rise again. */
const BREAK_TIME = 0.35
const REGROW_TIME = 2.5
/** Seconds for ore to pop up once its deposit has crumbled. */
const ORE_TIME = 0.4
/** Halo strength; kept faint so rare deposits catch the eye without lighting up the scene. */
const HALO_STRENGTH = 0.3
const ORE_GLOW = 0.6

/**
 * Shapes and materials for every deposit type, created once and shared by every field built from
 * them, so streaming deposits in and out never compiles a shader or rebuilds a shape.
 */
export interface DepositAssets {
  /** Shape of a deposit type (each field takes its own copy, to carry per-instance effects). */
  geometry(resourceId: string): BufferGeometry
  material(resourceId: string): Material
  halo: { geometry: BufferGeometry; material: Material }
  ore: { geometry: BufferGeometry; material: Material }
  dispose(): void
}

export function createDepositAssets(reflection: Texture): DepositAssets {
  const geometries = new Map<string, BufferGeometry>()
  const materials = new Map<string, Material>()
  const def = (id: string): ResourceDef => {
    const resource = getResource(id)
    if (!resource) throw new Error(`Unknown resource ${id}`)
    return resource
  }
  const halo = { geometry: createHaloGeometry(), material: createHaloMaterial() }
  const ore = { geometry: createOreGeometry(), material: withPlanetShadow(createOreMaterial()) }
  return {
    geometry(id) {
      let g = geometries.get(id)
      if (!g) geometries.set(id, (g = createDepositGeometry(def(id).appearance)))
      return g
    },
    material(id) {
      let m = materials.get(id)
      if (!m) materials.set(id, (m = withPlanetShadow(createDepositMaterial(def(id).appearance, reflection))))
      return m
    },
    halo,
    ore,
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      for (const part of [halo, ore]) {
        part.geometry.dispose()
        part.material.dispose()
      }
    },
  }
}

/** How a deposit looks right now, kept when the set of deposits shown changes. */
export interface DepositLook {
  /** 0 = gone, 1 = fully standing. */
  presence: number
  /** Ore on the ground: 0 = none, 1 = fully shown. */
  ore: number
  /** Beam heat, 0..1, smoothed. */
  heat: number
}

interface Visual extends DepositLook {
  deposit: Deposit
  rotation: Quaternion
  /** The local vertical at the deposit. */
  up: Vector3
  /** Turns +Y onto that vertical (for the ore heap, which stands upright). */
  upright: Quaternion
  mesh: InstancedMesh
  slot: number
  /** Halo instance, or -1. */
  halo: number
  /** Ore instance. */
  oreSlot: number
  /** Matrix needs rewriting this frame. */
  moved: boolean
  /** Jump straight to the current state at the next update, without animating. */
  snap: boolean
  /** Random phase so ore piles don't bob in step. */
  phase: number
}

export interface DepositField {
  object: Group
  /** Advances break, regrowth and mining animations to match the mined-out state. */
  update(sites: DepositSites, dt: number, time: number): void
  /** Shows the state at the next update without animating, e.g. after loading a save. */
  snap(): void
  /** Each deposit's current look, by id, to carry over into the next field. */
  looks(): Map<string, DepositLook>
  /** Frees this field's own buffers (the shared assets stay). */
  dispose(): void
}

/**
 * A set of deposits drawn with instancing: one mesh per deposit type, one for all halos and two
 * for ore heaps, so a whole field costs a handful of draw calls. Instances are only rewritten while
 * they animate. Deposits found in `carried` keep their look; the others appear as they are.
 */
export function createDepositField(deposits: readonly Deposit[], assets: DepositAssets, carried?: ReadonlyMap<string, DepositLook>): DepositField {
  const object = new Group()
  object.name = 'deposits'
  const own: BufferGeometry[] = []
  const meshes: InstancedMesh[] = []
  const visuals: Visual[] = []
  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const color = new Color()
  const spin = new Quaternion()
  const Y = new Vector3(0, 1, 0)
  const offset = new Vector3()

  const instanced = (geometry: BufferGeometry, material: Material, count: number) => {
    const mesh = new InstancedMesh(geometry, material, Math.max(1, count))
    mesh.count = count
    // Deposits spread around the astronaut, so culling a mesh as one never helps.
    mesh.frustumCulled = false
    meshes.push(mesh)
    return mesh
  }

  const haloDeposits = deposits.filter((d) => getResource(d.resourceId)?.appearance.halo)
  const haloMesh = instanced(assets.halo.geometry, assets.halo.material, haloDeposits.length)
  haloMesh.renderOrder = 1
  const oreMesh = instanced(assets.ore.geometry, assets.ore.material, deposits.length)
  oreMesh.castShadow = true
  oreMesh.receiveShadow = true
  // A small aura in the ore's colour, so ore stands out from the grey ground until it is picked up.
  const oreGlow = instanced(assets.halo.geometry, assets.halo.material, deposits.length)
  oreGlow.renderOrder = 1

  const haloIndex = new Map(haloDeposits.map((d, i) => [d.id, i]))
  const oreIndex = new Map(deposits.map((d, i) => [d.id, i]))
  for (const resourceId of Object.keys(RESOURCES)) {
    const members = deposits.filter((d) => d.resourceId === resourceId)
    if (members.length === 0) continue
    // A copy of the shape, carrying this field's per-instance effects.
    const geometry = assets.geometry(resourceId).clone()
    own.push(geometry)
    const fx = new Float32Array(members.length * 2)
    for (let i = 0; i < members.length; i++) fx[i * 2] = 1
    geometry.setAttribute('instanceFx', new InstancedBufferAttribute(fx, 2))
    const mesh = instanced(geometry, assets.material(resourceId), members.length)
    mesh.name = resourceId
    mesh.castShadow = true
    mesh.receiveShadow = true
    object.add(mesh)

    members.forEach((deposit, slot) => {
      // A small, stable brightness variation per deposit.
      const shadeSeed = Math.abs(Math.sin(deposit.x * 12.9898 + deposit.z * 78.233)) % 1
      mesh.setColorAt(slot, color.setScalar(0.9 + 0.16 * shadeSeed))
      const look = carried?.get(deposit.id)
      visuals.push({
        deposit,
        rotation: depositRotation(deposit, new Quaternion()),
        up: depositUp(deposit, new Vector3()),
        upright: new Quaternion().setFromUnitVectors(Y, depositUp(deposit, new Vector3())),
        mesh,
        slot,
        halo: haloIndex.get(deposit.id) ?? -1,
        oreSlot: oreIndex.get(deposit.id)!,
        presence: look?.presence ?? 1,
        ore: look?.ore ?? 0,
        heat: look?.heat ?? 0,
        moved: true,
        snap: !look,
        phase: shadeSeed * Math.PI * 2,
      })
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  haloDeposits.forEach((deposit, i) => {
    haloMesh.setColorAt(i, color.set(getResource(deposit.resourceId)!.appearance.halo!).multiplyScalar(HALO_STRENGTH))
  })
  if (haloMesh.instanceColor) haloMesh.instanceColor.needsUpdate = true
  deposits.forEach((deposit, i) => {
    oreMesh.setColorAt(i, color.set(getItem(getResource(deposit.resourceId)?.itemId ?? '')?.color ?? '#ffffff'))
    oreGlow.setColorAt(i, color.multiplyScalar(ORE_GLOW))
    oreMesh.setMatrixAt(i, matrix.makeScale(0, 0, 0))
    oreGlow.setMatrixAt(i, matrix)
  })
  if (oreMesh.instanceColor) oreMesh.instanceColor.needsUpdate = true
  if (oreGlow.instanceColor) oreGlow.instanceColor.needsUpdate = true
  object.add(haloMesh, oreMesh, oreGlow)

  return {
    object,
    update(sites, dt, time) {
      const target = miningRuntime.mining && miningRuntime.targetKind === 'deposit' ? miningRuntime.target : null
      let oreChanged = false
      let haloChanged = false
      for (const v of visuals) {
        const d = v.deposit
        const depleted = d.id in sites.depleted
        const bounds = DEPOSIT_BOUNDS[getResource(d.resourceId)!.appearance.shape]

        // Mined-out deposits crumble fast and regrow slowly.
        const goal = depleted ? 0 : 1
        if (v.snap) v.presence = goal
        else if (v.presence !== goal) {
          v.presence = depleted ? Math.max(0, v.presence - dt / BREAK_TIME) : Math.min(1, v.presence + dt / REGROW_TIME)
          v.moved = true
        }

        const heated = target?.id === d.id
        const heat = heated ? Math.min(1, v.heat + dt * 2.5) : Math.max(0, v.heat - dt * 1.5)
        const fx = v.mesh.geometry.getAttribute('instanceFx') as InstancedBufferAttribute
        if (heat !== v.heat || heated || v.moved) {
          v.heat = heat
          // Flicker the deposit's own glow under the beam; fade it in as the deposit regrows.
          const flicker = heated ? 0.85 + 0.35 * Math.sin(time * 37 + v.phase) : 1
          fx.setXY(v.slot, v.presence * flicker, heat * 0.28)
          fx.needsUpdate = true
        }

        if (v.moved || heated) {
          const k = v.presence * v.presence * (3 - 2 * v.presence)
          position.set(d.x, d.y, d.z)
          // The beam shakes loose grit: a small tremor while mined.
          if (heated) position.add(offset.set(Math.random() - 0.5, 0, Math.random() - 0.5).applyQuaternion(v.upright).multiplyScalar(0.025 * d.size))
          v.mesh.setMatrixAt(v.slot, matrix.compose(position, v.rotation, scale.setScalar(d.size * k)))
          v.mesh.instanceMatrix.needsUpdate = true
          if (v.halo >= 0) {
            const r = bounds.radius * d.size * 1.35 * k
            const h = bounds.height * d.size * 0.75 * k
            position.set(d.x, d.y, d.z).addScaledVector(v.up, bounds.height * d.size * 0.45)
            haloMesh.setMatrixAt(v.halo, matrix.compose(position, v.rotation, scale.set(r, h, r)))
            haloChanged = true
          }
          v.moved = false
        }

        // Ore pops up once the deposit has crumbled, then bobs and turns slowly until collected.
        const oreGoal = d.id in sites.drops && v.presence < 0.3 ? 1 : 0
        const shown = v.ore
        if (v.snap) v.ore = oreGoal
        else if (v.ore !== oreGoal) v.ore = oreGoal ? Math.min(1, v.ore + dt / ORE_TIME) : Math.max(0, v.ore - dt / ORE_TIME)
        if (v.ore > 0 || shown > 0 || v.snap) {
          const i = v.oreSlot
          // Overshoot a little as it appears.
          const pop = v.ore < 1 ? Math.sin(v.ore * Math.PI * 0.5) * (1 + 0.25 * Math.sin(v.ore * Math.PI)) : 1
          const size = clamp(0.85 + d.yield * 0.08, 0.9, 1.4) * pop
          position.set(d.x, d.y, d.z).addScaledVector(v.up, 0.08 + 0.05 * Math.sin(time * 2 + v.phase))
          // Upright on the ground, turning slowly about the local vertical.
          spin.setFromAxisAngle(Y, time * 0.7 + v.phase).premultiply(v.upright)
          oreMesh.setMatrixAt(i, matrix.compose(position, spin, scale.setScalar(size)))
          position.addScaledVector(v.up, 0.1)
          oreGlow.setMatrixAt(i, matrix.compose(position, spin, scale.set(0.6 * size, 0.45 * size, 0.6 * size)))
          oreChanged = true
        }
        v.snap = false
      }
      if (oreChanged) {
        oreMesh.instanceMatrix.needsUpdate = true
        oreGlow.instanceMatrix.needsUpdate = true
      }
      if (haloChanged) haloMesh.instanceMatrix.needsUpdate = true
    },
    snap() {
      for (const v of visuals) {
        v.snap = true
        v.moved = true
      }
    },
    looks() {
      return new Map(visuals.map((v) => [v.deposit.id, { presence: v.presence, ore: v.ore, heat: v.heat }]))
    },
    dispose() {
      own.forEach((g) => g.dispose())
      meshes.forEach((m) => m.dispose())
    },
  }
}
