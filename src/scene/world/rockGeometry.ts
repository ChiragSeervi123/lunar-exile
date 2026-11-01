import { BufferAttribute, IcosahedronGeometry, type BufferGeometry } from 'three'
import { ROCK_CLASSES, ROCK_VARIANTS, type RockClass } from '@/game/world'
import type { RegionDef } from '@/types/content'
import { smoothstep } from '@/utils/math'
import { createNoise3D, fbm3 } from '@/utils/noise'
import { createRng, deriveSeed, randRange } from '@/utils/random'

/** Shape detail per class: icosahedron subdivisions and surface roughness. */
const ROCK_SHAPES: Record<RockClass, { detail: number; roughness: number }> = {
  debris: { detail: 0, roughness: 0.35 },
  medium: { detail: 1, roughness: 0.32 },
  boulder: { detail: 2, roughness: 0.3 },
}

/** Every rock shape for a region: the variants of each class. Shared by rendering and collision. */
export function createRockSet(region: RegionDef): Record<RockClass, BufferGeometry[]> {
  const set = {} as Record<RockClass, BufferGeometry[]>
  for (const cls of ROCK_CLASSES) {
    const { detail, roughness } = ROCK_SHAPES[cls]
    set[cls] = Array.from({ length: ROCK_VARIANTS }, (_, variant) =>
      createRockGeometry(deriveSeed(region.terrain.seed, `${cls}-${variant}`), detail, roughness),
    )
  }
  return set
}

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
