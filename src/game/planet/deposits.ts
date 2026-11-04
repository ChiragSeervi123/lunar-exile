import type { Deposit, RegionDeposits } from '@/game/mining'
import { multiplyQuat, quat, quatFromEulerXZY, vec3 } from '@/utils/vec3'
import { chartDirection, chartRotation } from './frame'
import type { Planet } from './sampler'

/**
 * The landing site's deposits (Milestone 3) on the Moon: placed through the landing-site map
 * exactly where they were, at the same height above the ground, leaning and turned the same way.
 * Ids are unchanged, so mined-out sites in saved games still match.
 */
export function placeLandingDeposits(planet: Planet, deposits: RegionDeposits): RegionDeposits {
  const R = planet.radius
  const flat = planet.landing.terrain
  const dir = vec3()
  const frame = quat()
  const q = quat()
  const list: Deposit[] = deposits.list.map((d) => {
    chartDirection(d.x, d.z, R, dir)
    const radius = R + planet.heightAt(dir) + (d.y - flat.heightAt(d.x, d.z))
    quatFromEulerXZY(q, d.pitch, d.yaw, d.roll)
    multiplyQuat(q, chartRotation(d.x, d.z, R, frame), q)
    return { ...d, x: dir.x * radius, y: dir.y * radius, z: dir.z * radius, orientation: [q.x, q.y, q.z, q.w] }
  })
  return { list, byId: new Map(list.map((deposit) => [deposit.id, deposit])) }
}
