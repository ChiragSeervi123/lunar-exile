export const DEG2RAD = Math.PI / 180

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Hermite step from 0 at `edge0` to 1 at `edge1`; the edges may be given in either order. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Polynomial smooth minimum; `k` is the width of the blend. */
export function smoothMin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1)
  return lerp(b, a, h) - k * h * (1 - h)
}

export function smoothMax(a: number, b: number, k: number): number {
  return -smoothMin(-a, -b, k)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * Unit vector toward a point in the sky. Azimuth is in degrees clockwise from north (-Z) toward
 * east (+X); elevation is in degrees above the horizon.
 */
export function directionFromAngles(azimuth: number, elevation: number): [number, number, number] {
  const az = azimuth * DEG2RAD
  const el = elevation * DEG2RAD
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
}
