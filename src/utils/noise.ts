// Seeded simplex noise (after Stefan Gustavson's public-domain reference implementation).
import type { Rng } from './random'

export type Noise2D = (x: number, y: number) => number
export type Noise3D = (x: number, y: number, z: number) => number

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
  1, 0, 1, -1, 0, -1, -1,
])

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const F3 = 1 / 3
const G3 = 1 / 6

function buildPermutation(rng: Rng): { perm: Uint8Array; grad: Uint8Array } {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  const perm = new Uint8Array(512)
  const grad = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    grad[i] = (perm[i] % 12) * 3
  }
  return { perm, grad }
}

/** 2D simplex noise in roughly [-1, 1]. */
export function createNoise2D(rng: Rng): Noise2D {
  const { perm, grad } = buildPermutation(rng)
  return (x, y) => {
    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const t = (i + j) * G2
    const x0 = x - (i - t)
    const y0 = y - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255

    let n = 0
    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 > 0) {
      const g = grad[ii + perm[jj]]
      t0 *= t0
      n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0)
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 > 0) {
      const g = grad[ii + i1 + perm[jj + j1]]
      t1 *= t1
      n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1)
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 > 0) {
      const g = grad[ii + 1 + perm[jj + 1]]
      t2 *= t2
      n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2)
    }
    return 70 * n
  }
}

/** 3D simplex noise in roughly [-1, 1]. */
export function createNoise3D(rng: Rng): Noise3D {
  const { perm, grad } = buildPermutation(rng)
  return (x, y, z) => {
    const s = (x + y + z) * F3
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const k = Math.floor(z + s)
    const t = (i + j + k) * G3
    const x0 = x - (i - t)
    const y0 = y - (j - t)
    const z0 = z - (k - t)

    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0]
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1]
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1]
    } else if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1]
    else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1]
    else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0]

    const x1 = x0 - i1 + G3
    const y1 = y0 - j1 + G3
    const z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3
    const y2 = y0 - j2 + 2 * G3
    const z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3
    const y3 = y0 - 1 + 3 * G3
    const z3 = z0 - 1 + 3 * G3
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255

    let n = 0
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
    if (t0 > 0) {
      const g = grad[ii + perm[jj + perm[kk]]]
      t0 *= t0
      n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0)
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
    if (t1 > 0) {
      const g = grad[ii + i1 + perm[jj + j1 + perm[kk + k1]]]
      t1 *= t1
      n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1)
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
    if (t2 > 0) {
      const g = grad[ii + i2 + perm[jj + j2 + perm[kk + k2]]]
      t2 *= t2
      n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2)
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
    if (t3 > 0) {
      const g = grad[ii + 1 + perm[jj + 1 + perm[kk + 1]]]
      t3 *= t3
      n += t3 * t3 * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3)
    }
    return 32 * n
  }
}

/** Fractal Brownian motion: summed octaves of noise, normalised to roughly [-1, 1]. */
export function fbm2(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0
  let amplitude = 1
  let frequency = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency + o * 17.31, y * frequency - o * 9.17)
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / norm
}

export function fbm3(noise: Noise3D, x: number, y: number, z: number, octaves: number): number {
  let sum = 0
  let amplitude = 1
  let frequency = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise(x * frequency + o * 17.31, y * frequency - o * 9.17, z * frequency + o * 4.73)
    norm += amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / norm
}

/** Ridged multifractal noise in roughly [0, 1]: sharp crests, suited to mountain ridges. */
export function ridged2(noise: Noise2D, x: number, y: number, octaves: number): number {
  let sum = 0
  let amplitude = 0.5
  let frequency = 1
  let previous = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(noise(x * frequency + o * 31.7, y * frequency + o * 11.3))
    n *= n
    sum += n * amplitude * previous
    norm += amplitude
    previous = n
    amplitude *= 0.5
    frequency *= 2.03
  }
  return sum / norm
}
