import { Vector3 } from 'three'
import { CAMERA } from '@/config/camera'
import { defaultFacing } from '@/game/player'
import type { RegionDef } from '@/types/content'
import { clamp, DEG2RAD } from '@/utils/math'

export interface CameraPose {
  position: Vector3
  target: Vector3
}

/** Writes the shot's pose at `time` into `out`. `aspect` is the viewport's width / height. */
export type Shot = (time: number, aspect: number, out: CameraPose) => CameraPose

export function createPose(): CameraPose {
  return { position: new Vector3(), target: new Vector3() }
}

/**
 * The main menu's slow pan across the landing site, framed toward Earth (away from the sun where
 * Earth never rises) with Earth on the right third of the frame.
 */
export function createMenuShot(region: RegionDef, spawn: { x: number; y: number; z: number }): Shot {
  const heading = defaultFacing(region)
  const { menu } = CAMERA
  return (time, aspect, out) => {
    // Narrow (portrait) screens see less horizontally, so off-centre framing has to shrink.
    const k = clamp(aspect / CAMERA.referenceAspect, 0.3, 1)
    const sway = menu.sway * Math.sin((time / menu.period) * Math.PI * 2)
    const yaw = heading + (sway - menu.frameOffset) * k * DEG2RAD
    const fx = Math.sin(yaw)
    const fz = -Math.cos(yaw)
    out.position.set(spawn.x - fx * menu.distance, spawn.y + menu.height, spawn.z - fz * menu.distance)
    out.target.set(spawn.x + fx * menu.lookAhead, spawn.y + menu.lookHeight, spawn.z + fz * menu.lookAhead)
    return out
  }
}
