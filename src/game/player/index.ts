import type { RegionDef } from '@/types/content'
import { DEG2RAD } from '@/utils/math'

export * from './animation'
export * from './movement'

export type CameraMode = 'first-person' | 'third-person'

/**
 * Where the player body appears when a game resumes: world space, with the Moon's centre at the
 * origin (the landing site is straight up, +Y).
 */
export interface PlayerPose {
  /** Feet position, meters. */
  position: [number, number, number]
  /** Unit vector along the ground: the way the body faced. */
  forward: [number, number, number]
}

/** Heading the player starts with: toward Earth, or away from the sun where Earth never rises. */
export function defaultFacing(region: RegionDef): number {
  return (region.sky.earth?.azimuth ?? region.sky.sun.azimuth + 180) * DEG2RAD
}
