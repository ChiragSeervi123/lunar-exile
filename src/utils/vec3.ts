/*
 * Plain 3D vectors and quaternions for game logic that must not depend on three.js. Every function
 * writes into `out` and returns it, so hot paths can reuse objects instead of allocating. Inputs may
 * alias `out`.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Quat {
  x: number
  y: number
  z: number
  w: number
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z }
}

export function quat(x = 0, y = 0, z = 0, w = 1): Quat {
  return { x, y, z, w }
}

export function setVec(out: Vec3, x: number, y: number, z: number): Vec3 {
  out.x = x
  out.y = y
  out.z = z
  return out
}

export function copyVec(out: Vec3, a: Vec3): Vec3 {
  return setVec(out, a.x, a.y, a.z)
}

export function addVec(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  return setVec(out, a.x + b.x, a.y + b.y, a.z + b.z)
}

export function subVec(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  return setVec(out, a.x - b.x, a.y - b.y, a.z - b.z)
}

export function scaleVec(out: Vec3, a: Vec3, s: number): Vec3 {
  return setVec(out, a.x * s, a.y * s, a.z * s)
}

/** out = a + b × s */
export function addScaled(out: Vec3, a: Vec3, b: Vec3, s: number): Vec3 {
  return setVec(out, a.x + b.x * s, a.y + b.y * s, a.z + b.z * s)
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

export function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  return setVec(out, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
}

export function length(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

/** Unit vector along `a`; a zero vector stays zero. */
export function normalize(out: Vec3, a: Vec3): Vec3 {
  const l = length(a)
  return l > 0 ? scaleVec(out, a, 1 / l) : setVec(out, 0, 0, 0)
}

/** The smallest rotation taking unit vector `from` to unit vector `to` (any axis when they are opposite). */
export function quatFromUnitVectors(out: Quat, from: Vec3, to: Vec3): Quat {
  let r = dot(from, to) + 1
  if (r < 1e-12) {
    r = 0
    if (Math.abs(from.x) > Math.abs(from.z)) {
      out.x = -from.y
      out.y = from.x
      out.z = 0
    } else {
      out.x = 0
      out.y = -from.z
      out.z = from.y
    }
  } else {
    out.x = from.y * to.z - from.z * to.y
    out.y = from.z * to.x - from.x * to.z
    out.z = from.x * to.y - from.y * to.x
  }
  out.w = r
  return normalizeQuat(out, out)
}

export function normalizeQuat(out: Quat, q: Quat): Quat {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1
  out.x = q.x / l
  out.y = q.y / l
  out.z = q.z / l
  out.w = q.w / l
  return out
}

/** The rotation whose matrix has columns x, y and z (an orthonormal, right-handed basis). */
export function quatFromAxes(out: Quat, x: Vec3, y: Vec3, z: Vec3): Quat {
  const trace = x.x + y.y + z.z
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    out.w = 0.25 / s
    out.x = (y.z - z.y) * s
    out.y = (z.x - x.z) * s
    out.z = (x.y - y.x) * s
  } else if (x.x > y.y && x.x > z.z) {
    const s = 2 * Math.sqrt(1 + x.x - y.y - z.z)
    out.w = (y.z - z.y) / s
    out.x = 0.25 * s
    out.y = (y.x + x.y) / s
    out.z = (z.x + x.z) / s
  } else if (y.y > z.z) {
    const s = 2 * Math.sqrt(1 + y.y - x.x - z.z)
    out.w = (z.x - x.z) / s
    out.x = (y.x + x.y) / s
    out.y = 0.25 * s
    out.z = (z.y + y.z) / s
  } else {
    const s = 2 * Math.sqrt(1 + z.z - x.x - y.y)
    out.w = (x.y - y.x) / s
    out.x = (z.x + x.z) / s
    out.y = (z.y + y.z) / s
    out.z = 0.25 * s
  }
  return normalizeQuat(out, out)
}

export function multiplyQuat(out: Quat, a: Quat, b: Quat): Quat {
  const x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y
  const y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z
  const z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  out.x = x
  out.y = y
  out.z = z
  out.w = w
  return out
}

/** Rotation for Euler angles (radians) in 'XZY' order, exactly as three.js's `Quaternion.setFromEuler`. */
export function quatFromEulerXZY(out: Quat, x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  out.x = s1 * c2 * c3 - c1 * s2 * s3
  out.y = c1 * s2 * c3 - s1 * c2 * s3
  out.z = c1 * c2 * s3 + s1 * s2 * c3
  out.w = c1 * c2 * c3 + s1 * s2 * s3
  return out
}

/** `v` rotated by unit quaternion `q`. */
export function rotateVec(out: Vec3, q: Quat, v: Vec3): Vec3 {
  // t = 2 (q × v); v' = v + w t + q × t
  const tx = 2 * (q.y * v.z - q.z * v.y)
  const ty = 2 * (q.z * v.x - q.x * v.z)
  const tz = 2 * (q.x * v.y - q.y * v.x)
  return setVec(
    out,
    v.x + q.w * tx + (q.y * tz - q.z * ty),
    v.y + q.w * ty + (q.z * tx - q.x * tz),
    v.z + q.w * tz + (q.x * ty - q.y * tx),
  )
}
