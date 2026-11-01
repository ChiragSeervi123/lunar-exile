import { BufferAttribute, Color, Euler, IcosahedronGeometry, Matrix4, Quaternion, TorusGeometry, Vector3, type BufferGeometry } from 'three'
import type { DepositAppearance, DepositShape } from '@/types/content'
import { box, cylinder, part, rock, segment, shard, type Vec } from '../lowPoly'

/*
 * Low-poly deposit models, one per shape, at size 1 with the base on the ground (y = 0) and a
 * little sunk below it, sized to DEPOSIT_BOUNDS in game/mining. Besides colour, every vertex has
 * a 'glow' weight: how much of the material's emissive colour it shows, so only crystal tips or
 * alien lights glow, never whole deposits.
 */

/** A coloured piece with a glow weight (0 = never glows). */
function piece(geometry: BufferGeometry, color: string, glow: number, at?: Vec, rotate?: Vec, scale?: Vec): BufferGeometry {
  const p = part(geometry, color, at, rotate, scale)
  p.setAttribute('glow', new BufferAttribute(new Float32Array(p.getAttribute('position').count).fill(glow), 1))
  return p
}

/** Moves a group of pieces built around their own origin into place together. */
function placed(pieces: BufferGeometry[], at: Vec, rotate: Vec): BufferGeometry[] {
  const transform = new Matrix4().compose(
    new Vector3(...at),
    new Quaternion().setFromEuler(new Euler(...rotate)),
    new Vector3(1, 1, 1),
  )
  for (const p of pieces) p.applyMatrix4(transform)
  return pieces
}

/** A colour scaled in brightness, as a CSS string. */
function shade(color: string, factor: number): string {
  return `#${new Color(color).multiplyScalar(factor).getHexString()}`
}

type Builder = (color: string, accent: string) => BufferGeometry[]

const BUILDERS: Record<DepositShape, Builder> = {
  // A pale, smooth drift of fine dust with bright grains: soft where rocks are jagged.
  patch: (c, a) => [
    piece(rock(1, 1), c, 0, [0, -0.04, 0], [0, 0.3, 0], [0.78, 0.34, 0.7]),
    piece(rock(1, 0), shade(c, 0.93), 0, [0.48, -0.03, 0.28], [0.2, 1.1, 0], [0.32, 0.2, 0.28]),
    piece(rock(1, 0), shade(c, 0.96), 0, [-0.45, -0.03, -0.3], [0, 0.4, 0.2], [0.3, 0.17, 0.34]),
    ...(
      [
        [0.2, 0.27, 0.1],
        [-0.3, 0.24, -0.2],
        [0.45, 0.21, -0.15],
        [-0.1, 0.24, 0.35],
        [0.1, 0.22, -0.4],
        [-0.42, 0.13, 0.22],
      ] as Vec[]
    ).map((at, i) => piece(rock(0.045), a, 0, at, [i, i * 2, 0])),
  ],

  // Squared-off blocks of compacted regolith with pale strata: the only rectilinear deposit.
  blocks: (c, a) => [
    piece(box(0.56, 0.5, 0.46), c, 0, [0.02, 0.17, 0.02], [0.04, 0.35, 0.05]),
    piece(box(0.58, 0.05, 0.48), a, 0, [0.02, 0.27, 0.02], [0.04, 0.35, 0.05]),
    piece(box(0.4, 0.36, 0.34), shade(c, 0.9), 0, [0.36, 0.1, 0.24], [0.08, -0.45, 0.14]),
    ...placed(
      [piece(box(0.32, 0.62, 0.28), shade(c, 1.08), 0), piece(box(0.34, 0.04, 0.3), a, 0, [0, 0.1, 0])],
      [-0.3, 0.24, -0.18],
      [-0.12, 0.55, -0.16],
    ),
    piece(box(0.26, 0.24, 0.24), a, 0, [0.06, 0.53, 0.04], [0.25, 0.6, 0.12]),
    piece(box(0.2, 0.14, 0.18), shade(c, 0.85), 0, [0.42, -0.01, -0.3], [0.3, 0.2, 0.4]),
  ],

  // Bright metallic shards breaking out of a dark basalt boulder, with a seam across it.
  vein: (c, a) => [
    piece(rock(1, 0), a, 0, [0, 0.02, 0], [0.2, 0.5, 0], [0.62, 0.36, 0.52]),
    piece(rock(1, 0), shade(a, 1.2), 0, [0.36, -0.02, 0.22], [0, 1, 0.3], [0.3, 0.2, 0.26]),
    piece(shard(1), c, 0, [0.06, 0.48, 0.02], [0.12, 0, -0.22], [0.11, 0.48, 0.15]),
    piece(shard(1), c, 0, [-0.26, 0.38, 0.14], [0.35, 0.6, 0.55], [0.08, 0.36, 0.12]),
    piece(shard(1), shade(c, 0.9), 0, [0.3, 0.32, -0.16], [-0.4, 0.2, -0.65], [0.08, 0.3, 0.11]),
    piece(shard(1), c, 0, [-0.06, 0.3, -0.32], [-0.6, -0.3, 0.1], [0.07, 0.28, 0.1]),
    piece(box(0.95, 0.05, 0.1), c, 0, [0, 0.2, 0.24], [0.35, 0.3, 0.12]),
  ],

  // A frosty mound bristling with pale hexagonal crystals; only their tips glow much.
  crystals: (c, a) => {
    const crystal = (at: Vec, rotate: Vec, length: number, radius: number) =>
      placed(
        [
          piece(cylinder(radius * 0.92, radius, length, 6), c, 0.45, [0, length / 2, 0]),
          piece(cylinder(0, radius * 0.92, radius * 2.2, 6), a, 1, [0, length + radius * 1.1, 0]),
        ],
        at,
        rotate,
      )
    return [
      piece(rock(1, 0), shade(c, 0.55), 0, [0, -0.02, 0], [0, 0.4, 0], [0.48, 0.24, 0.42]),
      ...crystal([0, 0.05, 0], [0.05, 0, -0.08], 0.55, 0.085),
      ...crystal([0.17, 0.04, 0.08], [0.2, 0.3, -0.55], 0.38, 0.07),
      ...crystal([-0.16, 0.04, 0.1], [0.45, 0.8, 0.45], 0.34, 0.065),
      ...crystal([0.02, 0.03, -0.18], [-0.55, 0.2, 0.1], 0.32, 0.06),
      ...crystal([-0.12, 0.03, -0.1], [-0.3, 1.2, 0.5], 0.26, 0.05),
      ...crystal([0.2, 0.02, -0.12], [-0.4, -0.5, -0.6], 0.22, 0.05),
    ]
  },

  // Tall four-sided spires in two alien colours rising from dark rock: unmistakable at range.
  spires: (c, a) => {
    const base = shade(a, 0.3)
    const spire = (at: Vec, rotate: Vec, length: number, radius: number, color: string) =>
      placed([piece(cylinder(0, radius, length, 4), color, 0.85, [0, length / 2, 0], [0, Math.PI / 4, 0])], at, rotate)
    return [
      piece(rock(1, 0), base, 0, [0, 0, 0], [0.3, 0.2, 0], [0.62, 0.3, 0.55]),
      piece(rock(1, 0), shade(base, 1.25), 0, [0.42, -0.04, -0.2], [0, 0.8, 0.2], [0.3, 0.2, 0.28]),
      ...spire([0, 0.1, 0], [0.04, 0, -0.06], 2, 0.2, c),
      ...spire([0.22, 0.08, 0.12], [0.25, 0.4, -0.38], 1.35, 0.15, a),
      ...spire([-0.22, 0.06, 0.1], [0.35, -0.3, 0.42], 1.15, 0.14, c),
      ...spire([0.05, 0.05, -0.25], [-0.45, 0.2, 0.08], 1, 0.13, a),
      ...spire([-0.18, 0.04, -0.15], [-0.3, 0.9, 0.5], 0.75, 0.11, c),
      ...spire([0.3, 0.03, -0.1], [-0.2, -0.6, -0.7], 0.6, 0.1, a),
    ]
  },

  // A half-buried machined ring and a standing slab, both traced with faint alien light.
  relic: (c, a) => {
    const arc = Math.PI * 1.25
    // Glowing studs along the ring, in its own plane.
    const studs = [0.2, 0.5, 0.8].map((t) => {
      const angle = -Math.PI * 0.125 + arc * t
      return piece(box(0.08, 0.08, 0.05), a, 1, [0.75 * Math.cos(angle), 0.75 * Math.sin(angle), 0.09], [0, 0, angle])
    })
    return [
      piece(rock(1, 0), '#7d7b77', 0, [0.1, -0.05, 0.05], [0, 0.3, 0], [0.62, 0.2, 0.5]),
      ...placed(
        [piece(new TorusGeometry(0.75, 0.1, 4, 16, arc), c, 0, [0, 0, 0], [0, 0, -Math.PI * 0.125]), ...studs],
        [-0.1, 0.25, 0.1],
        [0.22, 0.3, 0],
      ),
      ...placed(
        [
          piece(box(0.36, 1.55, 0.16), shade(c, 1.15), 0),
          piece(box(0.035, 1.1, 0.02), a, 1, [-0.08, 0.1, 0.085]),
          piece(box(0.035, 0.7, 0.02), a, 1, [0.07, -0.1, 0.085]),
          piece(box(0.2, 0.035, 0.02), a, 1, [0, 0.55, 0.085]),
        ],
        [0.58, 0.62, -0.25],
        [0.06, 0.5, -0.1],
      ),
      piece(box(0.42, 0.08, 0.3), c, 0, [-0.55, 0, -0.45], [0.1, 0.7, 0.18]),
      piece(box(0.28, 0.06, 0.22), shade(c, 1.1), 0, [0.2, -0.01, 0.62], [-0.15, -0.4, 0.1]),
      piece(shard(1), a, 1, [-0.5, 0.06, -0.42], [0.4, 0, 0.9], [0.05, 0.12, 0.05]),
    ]
  },
}

export function createDepositGeometry(appearance: DepositAppearance): BufferGeometry {
  return segment(BUILDERS[appearance.shape](appearance.color, appearance.accent))
}

/** Unit sphere for the soft halo around rare deposits. */
export function createHaloGeometry(): BufferGeometry {
  return new IcosahedronGeometry(1, 2)
}

/** A small heap of ore chunks left by a broken deposit, white so the instance colour tints it. */
export function createOreGeometry(): BufferGeometry {
  return segment([
    part(rock(0.13), '#ffffff', [0, 0.1, 0], [0.3, 0.2, 0.5]),
    part(rock(0.1), '#ffffff', [0.14, 0.06, 0.08], [0.6, 1, 0.1]),
    part(rock(0.09), '#e6e6e6', [-0.12, 0.06, 0.06], [0.1, 0.4, 0.9]),
    part(rock(0.08), '#f0f0f0', [0.02, 0.05, -0.14], [1, 0.3, 0.2]),
    part(shard(1), '#ffffff', [-0.05, 0.16, -0.04], [0.3, 0.5, 0.2], [0.05, 0.12, 0.05]),
  ])
}
