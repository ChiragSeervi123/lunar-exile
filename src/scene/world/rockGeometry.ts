import { BufferAttribute, IcosahedronGeometry, type BufferGeometry } from 'three'
import { smoothstep } from '@/utils/math'
import { createNoise3D, fbm3 } from '@/utils/noise'
import { createRng, randRange } from '@/utils/random'

/**
 * Low-poly rock: a noise-displaced icosahedron with a few flat fracture planes, a flattened base
 * so it sits on the ground, and darker undersides baked into vertex colours.
 */
export function createRockGeometry(seed: number, detail: number, roughness: number): BufferGeometry {
  // Non-indexed: shared corners displace identically, so the surface stays closed and faceted.
  const geometry = new IcosahedronGeometry(1, detail)
  const position = geometry.getAttribute('position')
  const noise = createNoise3D(createRng(seed))
  const rng = createRng(seed ^ 0x5bd1e995)

  const stretch = [randRange(rng, 0.85, 1.3), randRange(rng, 0.7, 1), randRange(rng, 0.85, 1.3)]
  const cuts = Array.from({ length: 2 + Math.floor(rng() * 3) }, () => {
    const theta = rng() * Math.PI * 2
    const y = randRange(rng, -0.2, 0.8)
    const r = Math.sqrt(1 - y * y)
    return { nx: r * Math.cos(theta), ny: y, nz: r * Math.sin(theta), d: randRange(rng, 0.55, 0.8) }
  })

  const colors = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i)
    let y = position.getY(i)
    let z = position.getZ(i)
    const displacement = 1 + roughness * fbm3(noise, x * 1.4, y * 1.4, z * 1.4, 3)
    x *= displacement * stretch[0]
    y *= displacement * stretch[1]
    z *= displacement * stretch[2]
    for (const cut of cuts) {
      const k = x * cut.nx + y * cut.ny + z * cut.nz - cut.d
      if (k > 0) {
        x -= k * cut.nx
        y -= k * cut.ny
        z -= k * cut.nz
      }
    }
    if (y < -0.35) y = -0.35 + (y + 0.35) * 0.25
    position.setXYZ(i, x, y, z)

    const shade = 0.6 + 0.4 * smoothstep(-0.4, 0.55, y)
    colors[i * 3] = shade
    colors[i * 3 + 1] = shade
    colors[i * 3 + 2] = shade
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
