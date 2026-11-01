import {
  copyVec,
  cross,
  dot,
  normalize,
  quatFromAxes,
  quatFromUnitVectors,
  rotateVec,
  setVec,
  vec3,
  type Quat,
  type Vec3,
} from '@/utils/vec3'

/**
 * A local surface frame: up away from the Moon's centre, east and north along the ground. Gameplay
 * code that predates the planet (the movement motor, yaw angles) works in this frame exactly as it
 * did on the flat map, where east was +X, up +Y and north −Z.
 */
export interface Frame {
  up: Vec3
  east: Vec3
  north: Vec3
}

/** The landing site's frame at the +Y pole, identical to the flat map's axes. */
export function createFrame(): Frame {
  return { up: vec3(0, 1, 0), east: vec3(1, 0, 0), north: vec3(0, 0, -1) }
}

export function copyFrame(out: Frame, f: Frame): Frame {
  copyVec(out.up, f.up)
  copyVec(out.east, f.east)
  copyVec(out.north, f.north)
  return out
}

const turn: Quat = { x: 0, y: 0, z: 0, w: 1 }
const scratch = vec3()

/**
 * Carries a frame to a new up direction by the smallest rotation (parallel transport), so headings
 * stay continuous everywhere: there is no pole where east and north spin around.
 */
export function transportFrame(frame: Frame, up: Vec3): Frame {
  quatFromUnitVectors(turn, frame.up, up)
  rotateVec(frame.east, turn, frame.east)
  copyVec(frame.up, up)
  // Re-orthonormalise against drift.
  const along = dot(frame.east, up)
  frame.east.x -= up.x * along
  frame.east.y -= up.y * along
  frame.east.z -= up.z * along
  normalize(frame.east, frame.east)
  cross(frame.north, up, frame.east)
  return frame
}

/** A frame at `up` facing `north` (any vector not parallel to up); `north` is flattened onto the ground. */
export function frameFacing(out: Frame, up: Vec3, north: Vec3): Frame {
  copyVec(out.up, up)
  const along = dot(north, up)
  setVec(scratch, north.x - up.x * along, north.y - up.y * along, north.z - up.z * along)
  if (dot(scratch, scratch) < 1e-12) {
    // North parallel to up: any heading will do.
    setVec(scratch, Math.abs(up.y) < 0.9 ? 0 : 1, Math.abs(up.y) < 0.9 ? 1 : 0, 0)
    const k = dot(scratch, up)
    setVec(scratch, scratch.x - up.x * k, scratch.y - up.y * k, scratch.z - up.z * k)
  }
  normalize(out.north, scratch)
  cross(out.east, out.north, up)
  return out
}

/** World direction for a yaw (radians clockwise from north) and pitch (radians, positive up). */
export function frameDirection(frame: Frame, yaw: number, pitch: number, out: Vec3): Vec3 {
  const level = Math.cos(pitch)
  const e = Math.sin(yaw) * level
  const n = Math.cos(yaw) * level
  const u = Math.sin(pitch)
  return setVec(
    out,
    frame.east.x * e + frame.north.x * n + frame.up.x * u,
    frame.east.y * e + frame.north.y * n + frame.up.y * u,
    frame.east.z * e + frame.north.z * n + frame.up.z * u,
  )
}

/** A world vector in the frame's local axes as the flat map used them: x east, y up, z south. */
export function toLocal(frame: Frame, v: Vec3, out: Vec3): Vec3 {
  return setVec(out, dot(v, frame.east), dot(v, frame.up), -dot(v, frame.north))
}

/** Inverse of `toLocal`. */
export function toWorld(frame: Frame, local: Vec3, out: Vec3): Vec3 {
  const { east, up, north } = frame
  return setVec(
    out,
    east.x * local.x + up.x * local.y - north.x * local.z,
    east.y * local.x + up.y * local.y - north.y * local.z,
    east.z * local.x + up.z * local.y - north.z * local.z,
  )
}

const south = vec3()

/** Rotation from the flat map's axes (x east, y up, z south) to the frame's. */
export function frameRotation(frame: Frame, out: Quat): Quat {
  setVec(south, -frame.north.x, -frame.north.y, -frame.north.z)
  return quatFromAxes(out, frame.east, frame.up, south)
}

/*
 * The landing-site map: the flat region of Milestones 1–3, wrapped around the +Y pole with an
 * azimuthal equidistant projection. Distances and directions from the landing point are kept
 * exactly; at 300 m out, sideways distances shrink by only 0.1%.
 */

/** Unit direction for flat map coordinates (x east, z south, meters). */
export function chartDirection(x: number, z: number, radius: number, out: Vec3): Vec3 {
  const r = Math.hypot(x, z)
  if (r < 1e-9) return setVec(out, 0, 1, 0)
  const theta = r / radius
  const k = Math.sin(theta) / r
  return setVec(out, x * k, Math.cos(theta), z * k)
}

export interface ChartPoint {
  x: number
  z: number
  /** Distance from the landing point along the surface, meters. */
  distance: number
}

/** Flat map coordinates of a unit direction. Inverse of `chartDirection`. */
export function chartCoordinates(dir: Vec3, radius: number, out: ChartPoint): ChartPoint {
  const theta = Math.acos(Math.min(1, Math.max(-1, dir.y)))
  const across = Math.hypot(dir.x, dir.z)
  out.distance = theta * radius
  if (across < 1e-12) {
    out.x = 0
    out.z = 0
  } else {
    out.x = (dir.x / across) * out.distance
    out.z = (dir.z / across) * out.distance
  }
  return out
}

const pole = vec3(0, 1, 0)

/**
 * Rotation that carries the flat map's axes at its origin to the surface frame at map point (x, z):
 * the smallest rotation from the pole, which is how the projection transports directions.
 */
export function chartRotation(x: number, z: number, radius: number, out: Quat): Quat {
  return quatFromUnitVectors(out, pole, chartDirection(x, z, radius, scratch))
}
