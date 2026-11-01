export type Rng = () => number

/** Deterministic PRNG (mulberry32): the same seed yields the same sequence on every machine. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Independent seed for a named subsystem, so generators never share a random sequence. */
export function deriveSeed(seed: number, salt: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < salt.length; i++) hash = Math.imul(hash ^ salt.charCodeAt(i), 0x01000193) >>> 0
  return hash
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}
