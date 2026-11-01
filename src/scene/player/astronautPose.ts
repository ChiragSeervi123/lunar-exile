import type { AnimationState } from '@/game/player'

/** Joint angles (radians) and hip offset (meters) for the procedural astronaut. */
export interface AstronautPose {
  /** Vertical offset of the pelvis: bob, bounce and crouch. */
  bodyY: number
  /** Forward lean of the upper body. */
  lean: number
  /** Positive looks up. */
  headPitch: number
  /** Leg swing at the hip; positive swings forward. */
  hipL: number
  hipR: number
  /** Knee bend; positive folds the shin back. */
  kneeL: number
  kneeR: number
  /** Arm swing at the shoulder; positive swings forward. */
  shoulderL: number
  shoulderR: number
  /** Elbow bend; positive folds the forearm forward. */
  elbowL: number
  elbowR: number
  /** Arms held out from the body (the suit is bulky). */
  armOut: number
}

export const POSE_KEYS = [
  'bodyY',
  'lean',
  'headPitch',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'shoulderL',
  'shoulderR',
  'elbowL',
  'elbowR',
  'armOut',
] as const satisfies readonly (keyof AstronautPose)[]

export function createPose(): AstronautPose {
  return { bodyY: 0, lean: 0, headPitch: 0, hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shoulderL: 0, shoulderR: 0, elbowL: 0, elbowR: 0, armOut: 0 }
}

/** Distance covered per full gait cycle (two steps), meters. Keeps feet in step with the ground speed. */
export const STRIDE: Partial<Record<AnimationState, number>> = { walk: 1.6, run: 2.8 }

/**
 * Target pose for an animation state. `gait` is the walk-cycle phase (radians), `time` drives idle
 * breathing, `landing` (0..1) is how hard the last landing was.
 */
export function targetPose(state: AnimationState, gait: number, time: number, landing: number, out: AstronautPose): AstronautPose {
  const s = Math.sin(gait)
  const c = Math.cos(gait)
  const breath = Math.sin(time * 1.7)

  // Relaxed standing pose, which the other states build on.
  out.bodyY = 0.006 * breath
  out.lean = 0.03
  out.headPitch = 0.05 * Math.sin(time * 0.37)
  out.hipL = 0
  out.hipR = 0
  out.kneeL = 0.06
  out.kneeR = 0.06
  out.shoulderL = 0.04
  out.shoulderR = 0.04
  out.elbowL = 0.22
  out.elbowR = 0.22
  out.armOut = 0.15 + 0.012 * breath

  switch (state) {
    case 'walk':
      out.hipL = 0.42 * s
      out.hipR = -0.42 * s
      out.kneeL = 0.08 + 0.6 * Math.max(0, c)
      out.kneeR = 0.08 + 0.6 * Math.max(0, -c)
      out.shoulderL = -0.32 * s
      out.shoulderR = 0.32 * s
      out.elbowL = 0.3
      out.elbowR = 0.3
      out.bodyY = 0.035 * Math.abs(c) - 0.02
      out.lean = 0.07
      break
    case 'run':
      // Lunar lope: long bounding strides with the body bobbing high between them.
      out.hipL = 0.75 * s
      out.hipR = -0.75 * s
      out.kneeL = 0.2 + 1.05 * Math.max(0, c)
      out.kneeR = 0.2 + 1.05 * Math.max(0, -c)
      out.shoulderL = -0.6 * s
      out.shoulderR = 0.6 * s
      out.elbowL = 0.95
      out.elbowR = 0.95
      out.bodyY = 0.09 * Math.abs(s) - 0.04
      out.lean = 0.2
      out.armOut = 0.2
      break
    case 'jump':
      out.hipL = 0.6
      out.hipR = -0.15
      out.kneeL = 0.95
      out.kneeR = 0.35
      out.shoulderL = -0.45
      out.shoulderR = -0.45
      out.elbowL = 0.5
      out.elbowR = 0.5
      out.armOut = 0.5
      out.lean = 0.05
      out.headPitch = 0.12
      break
    case 'fall':
      out.hipL = 0.3
      out.hipR = 0.15
      out.kneeL = 0.35
      out.kneeR = 0.25
      out.shoulderL = 0.25
      out.shoulderR = 0.25
      out.elbowL = 0.45
      out.elbowR = 0.45
      out.armOut = 0.6
      out.lean = -0.04
      out.headPitch = -0.1
      break
    case 'land':
      out.hipL = 0.6 * landing
      out.hipR = 0.6 * landing
      out.kneeL = 0.06 + 1.0 * landing
      out.kneeR = 0.06 + 1.0 * landing
      out.bodyY = -0.15 * landing
      out.lean = 0.03 + 0.25 * landing
      out.shoulderL = 0.04 + 0.35 * landing
      out.shoulderR = 0.04 + 0.35 * landing
      out.elbowL = 0.22 + 0.4 * landing
      out.elbowR = 0.22 + 0.4 * landing
      out.armOut = 0.15 + 0.2 * landing
      out.headPitch = -0.15 * landing
      break
    default:
      break
  }
  return out
}
