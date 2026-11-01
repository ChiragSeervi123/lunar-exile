import {
  Color,
  Euler,
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
import { createDepositGeometry, createHaloGeometry, createOreGeometry } from './depositGeometry'
import { createDepositMaterial, createHaloMaterial, createOreMaterial } from './depositMaterials'

/** Seconds for a broken deposit to crumble away, and for a regrown one to rise again. */
const BREAK_TIME = 0.35
const REGROW_TIME = 2.5
/** Seconds for ore to pop up once its deposit has crumbled. */
const ORE_TIME = 0.4
/** Halo strength; kept faint so rare deposits catch the eye without lighting up the scene. */
const HALO_STRENGTH = 0.45
const ORE_GLOW = 0.6

interface Visual {
  deposit: Deposit
  rotation: Quaternion
  mesh: InstancedMesh
  slot: number
  /** Halo instance, or -1. */
  halo: number
  /** 0 = gone, 1 = fully standing. */
  presence: number
  /** Ore on the ground: 0 = none, 1 = fully shown. */
  ore: number
  /** Beam heat, 0..1, smoothed. */
  heat: number
  /** Matrix needs rewriting this frame. */
  moved: boolean
  /** Random phase so ore piles don't bob in step. */
  phase: number
}

export interface DepositField {
  object: Group
  /** Advances break, regrowth and mining animations to match the mined-out state. */
  update(sites: DepositSites, dt: number, time: number): void
  /** Shows the state at the next update without animating, e.g. after loading a save. */
  snap(): void
  dispose(): void
}

/**
 * Every deposit in a region, drawn with instancing: one mesh per deposit type, one for all halos
 * and one for all ore heaps, so the whole field costs a handful of draw calls. Instances are only
 * rewritten while they animate.
 */
export function createDepositField(deposits: readonly Deposit[], reflection: Texture): DepositField {
  const object = new Group()
  object.name = 'deposits'
  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const visuals: Visual[] = []
  const matrix = new Matrix4()
  const position = new Vector3()
  const scale = new Vector3()
  const color = new Color()
  const spin = new Quaternion()
  const euler = new Euler()
  const up = new Vector3(0, 1, 0)

  const haloDeposits = deposits.filter((d) => getResource(d.resourceId)?.appearance.halo)
  const haloMesh = new InstancedMesh(createHaloGeometry(), createHaloMaterial(), Math.max(1, haloDeposits.length))
  haloMesh.count = haloDeposits.length
  haloMesh.frustumCulled = false
  haloMesh.renderOrder = 1
  geometries.push(haloMesh.geometry)
  materials.push(haloMesh.material as Material)

  const oreMesh = new InstancedMesh(createOreGeometry(), createOreMaterial(), Math.max(1, deposits.length))
  oreMesh.count = deposits.length
  oreMesh.frustumCulled = false
  oreMesh.castShadow = true
  oreMesh.receiveShadow = true
  geometries.push(oreMesh.geometry)
  materials.push(oreMesh.material as Material)
  // A small aura in the ore's colour, so ore stands out from the grey ground until it is picked up.
  const oreGlow = new InstancedMesh(haloMesh.geometry, haloMesh.material, Math.max(1, deposits.length))
  oreGlow.count = deposits.length
  oreGlow.frustumCulled = false
  oreGlow.renderOrder = 1

  for (const [resourceId, def] of Object.entries(RESOURCES) as [string, ResourceDef][]) {
    const members = deposits.filter((d) => d.resourceId === resourceId)
    if (members.length === 0) continue
    const geometry = createDepositGeometry(def.appearance)
    const fx = new Float32Array(members.length * 2)
    for (let i = 0; i < members.length; i++) fx[i * 2] = 1
    geometry.setAttribute('instanceFx', new InstancedBufferAttribute(fx, 2))
    const mesh = new InstancedMesh(geometry, createDepositMaterial(def.appearance, reflection), members.length)
    mesh.name = resourceId
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Deposits spread across the whole region, so culling the mesh as one never helps.
    mesh.frustumCulled = false
    geometries.push(geometry)
    materials.push(mesh.material as Material)
    object.add(mesh)

    members.forEach((deposit, slot) => {
      // A small, stable brightness variation per deposit.
      const shadeSeed = Math.abs(Math.sin(deposit.x * 12.9898 + deposit.z * 78.233)) % 1
      mesh.setColorAt(slot, color.setScalar(0.9 + 0.16 * shadeSeed))
      visuals.push({
        deposit,
        rotation: new Quaternion().setFromEuler(euler.set(deposit.pitch, deposit.yaw, deposit.roll, 'XZY')),
        mesh,
        slot,
        halo: def.appearance.halo ? haloDeposits.indexOf(deposit) : -1,
        presence: 1,
        ore: 0,
        heat: 0,
        moved: true,
        phase: shadeSeed * Math.PI * 2,
      })
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  for (const deposit of haloDeposits) {
    const appearance = getResource(deposit.resourceId)!.appearance
    haloMesh.setColorAt(haloDeposits.indexOf(deposit), color.set(appearance.halo!).multiplyScalar(HALO_STRENGTH))
  }
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

  const oreIndex = new Map(deposits.map((deposit, i) => [deposit, i]))
  let first = true

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
        if (first) v.presence = goal
        else if (v.presence !== goal) {
          v.presence = depleted ? Math.max(0, v.presence - dt / BREAK_TIME) : Math.min(1, v.presence + dt / REGROW_TIME)
          v.moved = true
        }

        const heated = target === d
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
          if (heated) position.add(scale.set(Math.random() - 0.5, 0, Math.random() - 0.5).multiplyScalar(0.025 * d.size))
          v.mesh.setMatrixAt(v.slot, matrix.compose(position, v.rotation, scale.setScalar(d.size * k)))
          v.mesh.instanceMatrix.needsUpdate = true
          if (v.halo >= 0) {
            const r = bounds.radius * d.size * 1.45 * k
            const h = bounds.height * d.size * 0.8 * k
            position.set(d.x, d.y, d.z).addScaledVector(up, bounds.height * d.size * 0.45)
            haloMesh.setMatrixAt(v.halo, matrix.compose(position, v.rotation, scale.set(r, h, r)))
            haloChanged = true
          }
          v.moved = false
        }

        // Ore pops up once the deposit has crumbled, then bobs and turns slowly until collected.
        const oreGoal = d.id in sites.drops && v.presence < 0.3 ? 1 : 0
        const shown = v.ore
        if (first) v.ore = oreGoal
        else if (v.ore !== oreGoal) v.ore = oreGoal ? Math.min(1, v.ore + dt / ORE_TIME) : Math.max(0, v.ore - dt / ORE_TIME)
        if (v.ore > 0 || shown > 0 || first) {
          const i = oreIndex.get(d)!
          // Overshoot a little as it appears.
          const pop = v.ore < 1 ? Math.sin(v.ore * Math.PI * 0.5) * (1 + 0.25 * Math.sin(v.ore * Math.PI)) : 1
          const size = clamp(0.85 + d.yield * 0.08, 0.9, 1.4) * pop
          position.set(d.x, d.y + 0.08 + 0.05 * Math.sin(time * 2 + v.phase), d.z)
          spin.setFromAxisAngle(up, time * 0.7 + v.phase)
          oreMesh.setMatrixAt(i, matrix.compose(position, spin, scale.setScalar(size)))
          position.y += 0.1
          oreGlow.setMatrixAt(i, matrix.compose(position, spin, scale.set(0.6 * size, 0.45 * size, 0.6 * size)))
          oreChanged = true
        }
      }
      if (oreChanged) {
        oreMesh.instanceMatrix.needsUpdate = true
        oreGlow.instanceMatrix.needsUpdate = true
      }
      if (haloChanged) haloMesh.instanceMatrix.needsUpdate = true
      first = false
    },
    snap() {
      first = true
      for (const v of visuals) v.moved = true
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
