import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
  type Blending,
  type Color,
} from 'three'

/** Lunar gravity: sparks and dust fly in long, clean arcs; there is no air to slow or billow them. */
const GRAVITY = 1.62
const GPU_ATTRIBUTES = ['position', 'tint', 'size'] as const

/**
 * A fixed-size pool of soft round particles drawn in one call. Live particles are kept packed at
 * the front of the buffers, so updates and uploads only touch those; when the pool is full, new
 * particles are simply skipped. Nothing is allocated after construction.
 */
export class ParticlePool {
  readonly points: Points
  private readonly material: ShaderMaterial
  private readonly capacity: number
  private live = 0
  /** Particles in the GPU buffers as of the last upload. */
  private uploaded = 0
  // Simulation state, one entry per particle.
  private readonly velocity: Float32Array
  private readonly age: Float32Array
  private readonly life: Float32Array
  private readonly startSize: Float32Array
  private readonly endSize: Float32Array
  private readonly startAlpha: Float32Array
  // Buffers the GPU reads.
  private readonly position: Float32Array
  private readonly tint: Float32Array
  private readonly size: Float32Array

  constructor(capacity: number, additive: boolean) {
    this.capacity = capacity
    this.velocity = new Float32Array(capacity * 3)
    this.age = new Float32Array(capacity)
    this.life = new Float32Array(capacity)
    this.startSize = new Float32Array(capacity)
    this.endSize = new Float32Array(capacity)
    this.startAlpha = new Float32Array(capacity)
    this.position = new Float32Array(capacity * 3)
    this.tint = new Float32Array(capacity * 4)
    this.size = new Float32Array(capacity)

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.position, 3))
    geometry.setAttribute('tint', new BufferAttribute(this.tint, 4))
    geometry.setAttribute('size', new BufferAttribute(this.size, 1))
    geometry.setDrawRange(0, 0)
    this.material = createParticleMaterial(additive ? AdditiveBlending : NormalBlending)
    this.points = new Points(geometry, this.material)
    // Particles move every frame; bounds would be stale anyway.
    this.points.frustumCulled = false
    this.points.renderOrder = 2
  }

  get count(): number {
    return this.live
  }

  /** Adds a particle; returns false if the pool is full. Sizes are diameters in meters. */
  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    startSize: number,
    endSize: number,
    color: Color,
    alpha: number,
  ): boolean {
    if (this.live >= this.capacity) return false
    const i = this.live++
    const v = i * 3
    this.position[v] = x
    this.position[v + 1] = y
    this.position[v + 2] = z
    this.velocity[v] = vx
    this.velocity[v + 1] = vy
    this.velocity[v + 2] = vz
    this.tint[i * 4] = color.r
    this.tint[i * 4 + 1] = color.g
    this.tint[i * 4 + 2] = color.b
    this.tint[i * 4 + 3] = alpha
    this.age[i] = 0
    this.life[i] = life
    this.startSize[i] = startSize
    this.endSize[i] = endSize
    this.startAlpha[i] = alpha
    this.size[i] = startSize
    return true
  }

  /** Moves, fades and retires particles; `scale` converts meters at unit depth to pixels. */
  update(dt: number, scale: number): void {
    if (this.live === 0 && this.uploaded === 0) return
    this.material.uniforms.scale.value = scale
    let i = 0
    while (i < this.live) {
      const age = this.age[i] + dt
      if (age >= this.life[i]) {
        this.retire(i)
        continue
      }
      this.age[i] = age
      const t = age / this.life[i]
      const v = i * 3
      // Toward the Moon's centre, wherever the particle is.
      const px = this.position[v]
      const py = this.position[v + 1]
      const pz = this.position[v + 2]
      const g = (GRAVITY * dt) / (Math.hypot(px, py, pz) || 1)
      this.velocity[v] -= px * g
      this.velocity[v + 1] -= py * g
      this.velocity[v + 2] -= pz * g
      this.position[v] += this.velocity[v] * dt
      this.position[v + 1] += this.velocity[v + 1] * dt
      this.position[v + 2] += this.velocity[v + 2] * dt
      this.size[i] = this.startSize[i] + (this.endSize[i] - this.startSize[i]) * t
      this.tint[i * 4 + 3] = this.startAlpha[i] * (1 - t * t)
      i++
    }
    const geometry = this.points.geometry
    geometry.setDrawRange(0, this.live)
    for (const name of GPU_ATTRIBUTES) geometry.getAttribute(name).needsUpdate = true
    this.uploaded = this.live
  }

  clear(): void {
    this.live = 0
    this.uploaded = 0
    this.points.geometry.setDrawRange(0, 0)
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.material.dispose()
  }

  /** Swaps the last live particle into slot `i`. */
  private retire(i: number): void {
    const last = --this.live
    if (i === last) return
    this.position.copyWithin(i * 3, last * 3, last * 3 + 3)
    this.velocity.copyWithin(i * 3, last * 3, last * 3 + 3)
    this.tint.copyWithin(i * 4, last * 4, last * 4 + 4)
    this.age[i] = this.age[last]
    this.life[i] = this.life[last]
    this.startSize[i] = this.startSize[last]
    this.endSize[i] = this.endSize[last]
    this.startAlpha[i] = this.startAlpha[last]
    this.size[i] = this.size[last]
  }
}

function createParticleMaterial(blending: Blending): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { scale: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float scale;
      attribute vec4 tint;
      attribute float size;
      varying vec4 vTint;
      void main() {
        vTint = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, size * scale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec4 vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = vTint.a * (1.0 - smoothstep(0.35, 1.0, d));
        if (a <= 0.003) discard;
        gl_FragColor = vec4(vTint.rgb, a);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending,
  })
}
