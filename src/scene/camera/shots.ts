import { Vector3 } from 'three'
import { CAMERA } from '@/config/camera'
import type { Terrain } from '@/game/world'
import type { RegionDef } from '@/types/content'
import { clamp, DEG2RAD } from '@/utils/math'

export interface CameraPose {
  position: Vector3
  target: Vector3
}

export type ShotName = 'menu' | 'intro'

/** Writes the shot's pose at `time` into `out`. `aspect` is the viewport's width / height. */
export type Shot = (time: number, aspect: number, out: CameraPose) => CameraPose

export function createPose(): CameraPose {
  return { position: new Vector3(), target: new Vector3() }
}

/**
 * Cinematic shots framed around the landing zone and the view toward Earth. On the far side,
 * where Earth never rises, they face away from the sun instead.
 */
export function createShots(region: RegionDef, terrain: Terrain): Record<ShotName, Shot> {
  const { spawn } = terrain
  const heading = (region.sky.earth?.azimuth ?? region.sky.sun.azimuth + 180) * DEG2RAD
  const { menu, intro } = CAMERA
  // Narrow (portrait) screens see less horizontally, so off-centre framing has to shrink.
  const widthScale = (aspect: number) => clamp(aspect / CAMERA.referenceAspect, 0.3, 1)

  return {
    // A slow pan across the landing site, Earth on the right third of the frame.
    menu(time, aspect, out) {
      const k = widthScale(aspect)
      const sway = menu.sway * Math.sin((time / menu.period) * Math.PI * 2)
      const yaw = heading + (sway - menu.frameOffset) * k * DEG2RAD
      const fx = Math.sin(yaw)
      const fz = -Math.cos(yaw)
      out.position.set(spawn.x - fx * menu.distance, spawn.y + menu.height, spawn.z - fz * menu.distance)
      out.target.set(spawn.x + fx * menu.lookAhead, spawn.y + menu.lookHeight, spawn.z + fz * menu.lookAhead)
      return out
    },
    // Over the shoulder of where the astronaut will stand, looking out toward Earth.
    intro(time, aspect, out) {
      const yaw = heading - intro.frameOffset * widthScale(aspect) * DEG2RAD
      const side = yaw + intro.angle * DEG2RAD
      const drift = Math.sin(time * 0.13) * intro.drift
      out.position.set(
        spawn.x - Math.sin(side) * intro.distance + Math.cos(side) * drift,
        spawn.y + intro.height + Math.sin(time * 0.09) * intro.drift * 0.4,
        spawn.z + Math.cos(side) * intro.distance + Math.sin(side) * drift,
      )
      out.target.set(
        spawn.x + Math.sin(yaw) * intro.lookAhead,
        spawn.y + intro.lookHeight,
        spawn.z - Math.cos(yaw) * intro.lookAhead,
      )
      return out
    },
  }
}
