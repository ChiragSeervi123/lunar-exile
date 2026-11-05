import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { getItem } from '@/data/items'
import { getResource } from '@/data/resources'
import { DEPOSIT_BOUNDS, type Deposit } from '@/game/mining'
import { miningRuntime, playerRuntime, type MiningEvent } from '@/stores/runtime'
import { alongUp, depositUp } from './depositPose'
import { ParticlePool } from './particles'

/** Particles per second while the beam cuts. */
const SPARK_RATE = 90
const DUST_RATE = 26
/** Particles thrown out when a deposit breaks, and when ore is picked up. */
const BREAK_SPARKS = 70
const BREAK_DUST = 40
const COLLECT_SPARKLES = 24
const REGOLITH = new Color('#8f8a80')
const WHITE = new Color('#ffffff')

/** Soft round spot for the beam's contact glow. */
function createGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    glow.addColorStop(0, 'rgba(255,255,255,1)')
    glow.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, 64, 64)
  }
  return new CanvasTexture(canvas)
}

export interface MiningEffects {
  object: Group
  /** `pixelScale` converts a size in meters at 1 m depth to pixels. */
  update(dt: number, time: number, pixelScale: number): void
  dispose(): void
}

/**
 * Everything the beam shows: the beam itself, a contact glow and light, sparks and dust while it
 * cuts, a burst when a deposit breaks and a sparkle when ore is picked up. One light, three meshes
 * and two particle pools whose size follows the graphics quality, all created once.
 */
export function createMiningEffects(particleBudget: number, beamColor: string): MiningEffects {
  const object = new Group()
  object.name = 'mining-effects'
  const beamTint = new Color(beamColor)

  // A unit cylinder from y = 0 to 1, stretched from the tool to the target.
  const beamGeometry = new CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0)
  const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }
  const coreMaterial = new MeshBasicMaterial({ color: new Color(beamTint).lerp(WHITE, 0.55), ...additive })
  const glowMaterial = new MeshBasicMaterial({ color: beamTint, opacity: 0.28, ...additive })
  const core = new Mesh(beamGeometry, coreMaterial)
  const glow = new Mesh(beamGeometry, glowMaterial)
  const glowTexture = createGlowTexture()
  const contactMaterial = new SpriteMaterial({ map: glowTexture, color: beamTint, ...additive })
  const contact = new Sprite(contactMaterial)
  // Always present, dark when idle, so lighting never changes shape and shaders never recompile.
  const light = new PointLight(beamTint, 0, 7, 2)
  for (const o of [core, glow, contact]) {
    o.visible = false
    o.frustumCulled = false
  }
  const sparks = new ParticlePool(Math.round(particleBudget * 0.6), true)
  const dust = new ParticlePool(Math.round(particleBudget * 0.4), false)
  object.add(core, glow, contact, light, sparks.points, dust.points)

  const tip = new Vector3()
  const point = new Vector3()
  const beam = new Vector3()
  const up = new Vector3(0, 1, 0)
  const color = new Color()
  const resourceColor = new Color()
  let strength = 0
  let sparkDebt = 0
  let dustDebt = 0

  const randomUnit = (out: Vector3) => {
    const z = Math.random() * 2 - 1
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    return out.set(r * Math.cos(a), z, r * Math.sin(a))
  }
  const direction = new Vector3()
  const toPlayer = new Vector3()
  const vertical = new Vector3()
  const origin = new Vector3()

  /** Lays a beam mesh from the tool tip along the beam direction. */
  const stretch = (mesh: Mesh, radius: number, length: number) => {
    mesh.position.copy(tip)
    mesh.quaternion.setFromUnitVectors(up, beam)
    mesh.scale.set(radius, length, radius)
  }

  const burst = (event: MiningEvent) => {
    const d: Deposit = event.deposit
    const resource = getResource(d.resourceId)
    if (!resource) return
    const item = getItem(resource.itemId)
    resourceColor.set(item?.color ?? resource.appearance.color)
    // Directions are made with +Y up, then turned onto the deposit's own vertical.
    depositUp(d, vertical)
    if (event.type === 'break') {
      const height = DEPOSIT_BOUNDS[resource.appearance.shape].height * d.size
      origin.set(d.x, d.y, d.z).addScaledVector(vertical, height * 0.4)
      for (let i = 0; i < BREAK_SPARKS; i++) {
        randomUnit(direction)
        direction.y = Math.abs(direction.y) * 0.8 + 0.2
        alongUp(direction, vertical)
        const speed = 1.5 + Math.random() * 3
        color.copy(resourceColor).lerp(WHITE, Math.random() * 0.35)
        const life = 0.8 + Math.random() * 0.8
        const size = 0.06 + Math.random() * 0.06
        sparks.spawn(origin.x, origin.y, origin.z, direction.x * speed, direction.y * speed, direction.z * speed, life, size, 0.02, color, 1)
      }
      origin.set(d.x, d.y, d.z).addScaledVector(vertical, 0.15)
      for (let i = 0; i < BREAK_DUST; i++) {
        randomUnit(direction)
        direction.y = Math.abs(direction.y) * 0.6 + 0.15
        alongUp(direction, vertical)
        const speed = 0.6 + Math.random() * 1.4
        color.copy(REGOLITH).lerp(resourceColor, 0.25)
        const life = 1.2 + Math.random()
        dust.spawn(origin.x, origin.y, origin.z, direction.x * speed, direction.y * speed, direction.z * speed, life, 0.14, 0.5, color, 0.55)
      }
    } else {
      // Sparkles lift off the ore toward the astronaut.
      const p = playerRuntime.renderPosition
      toPlayer.set(p.x - d.x, p.y - d.y, p.z - d.z)
      toPlayer.addScaledVector(vertical, -toPlayer.dot(vertical)).normalize()
      origin.set(d.x, d.y, d.z).addScaledVector(vertical, 0.2)
      for (let i = 0; i < COLLECT_SPARKLES; i++) {
        randomUnit(direction).multiplyScalar(0.6).addScaledVector(toPlayer, 1.4)
        // Rising off the ground, whatever the sideways spread.
        direction.addScaledVector(vertical, 1.8 + Math.random() - direction.dot(vertical))
        color.copy(resourceColor).lerp(WHITE, 0.3)
        const life = 0.5 + Math.random() * 0.4
        sparks.spawn(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, life, 0.06, 0, color, 1)
      }
    }
  }

  return {
    object,
    update(dt, time, pixelScale) {
      const m = miningRuntime
      for (const event of m.events) burst(event)
      m.events.length = 0

      // Fast attack, quick release, so the beam snaps on and fades out.
      strength = m.mining ? Math.min(1, strength + dt * 12) : Math.max(0, strength - dt * 8)
      const on = strength > 0.01 && (m.target !== null || m.digging)
      core.visible = on
      glow.visible = on
      contact.visible = on
      light.intensity = on ? strength * (5 + 2.5 * Math.sin(time * 41)) : 0
      if (on) {
        tip.set(m.toolTip.x, m.toolTip.y, m.toolTip.z)
        point.set(m.point.x, m.point.y, m.point.z)
        beam.subVectors(point, tip)
        const length = Math.max(0.01, beam.length())
        beam.divideScalar(length)
        const flicker = 0.8 + 0.25 * Math.sin(time * 53) + 0.15 * Math.random()
        stretch(core, 0.012 * flicker * strength, length)
        stretch(glow, 0.045 * flicker * strength, length)
        contact.position.copy(point).addScaledVector(beam, -0.04)
        contact.scale.setScalar((0.35 + 0.15 * flicker) * strength)
        light.position.copy(point).addScaledVector(beam, -0.3)

        if (m.mining && (m.target || m.digging)) {
          // A deposit throws its own colour; dug rock throws grey regolith.
          const resource = m.target ? getResource(m.target.resourceId) : undefined
          if (resource) resourceColor.set(getItem(resource.itemId)?.color ?? resource.appearance.color)
          else resourceColor.copy(REGOLITH)
          sparkDebt += SPARK_RATE * dt
          while (sparkDebt >= 1) {
            sparkDebt -= 1
            // Sprayed back out of the cut, toward the tool, in a wide cone.
            randomUnit(direction).multiplyScalar(0.9).addScaledVector(beam, -1).normalize()
            const speed = 1.5 + Math.random() * 2.5
            if (Math.random() < 0.65) color.copy(beamTint).lerp(WHITE, Math.random() * 0.6)
            else color.copy(resourceColor)
            const life = 0.35 + Math.random() * 0.45
            const size = 0.035 + Math.random() * 0.025
            sparks.spawn(point.x, point.y, point.z, direction.x * speed, direction.y * speed, direction.z * speed, life, size, 0.01, color, 1)
          }
          dustDebt += DUST_RATE * dt
          while (dustDebt >= 1) {
            dustDebt -= 1
            randomUnit(direction)
            direction.y = Math.abs(direction.y) + 0.4
            alongUp(direction, vertical.copy(point).normalize())
            const speed = 0.5 + Math.random() * 0.8
            color.copy(REGOLITH).lerp(resourceColor, 0.3)
            const life = 0.9 + Math.random() * 0.7
            const size = 0.08 + Math.random() * 0.06
            dust.spawn(point.x, point.y, point.z, direction.x * speed, direction.y * speed, direction.z * speed, life, size, 0.3, color, 0.5)
          }
        }
      }
      sparks.update(dt, pixelScale)
      dust.update(dt, pixelScale)
    },
    dispose() {
      beamGeometry.dispose()
      coreMaterial.dispose()
      glowMaterial.dispose()
      contactMaterial.dispose()
      glowTexture.dispose()
      sparks.dispose()
      dust.dispose()
    },
  }
}
