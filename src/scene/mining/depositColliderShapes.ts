import { Quaternion, Vector3 } from 'three'
import { getResource } from '@/data/resources'
import { depositBox, DROP_BOX, type Deposit, type DepositBox, type SiteFeature } from '@/game/mining'
import { depositRotation } from './depositPose'

export interface DepositColliderShape {
  deposit: Deposit
  feature: SiteFeature
  /** Blocks the astronaut and camera like a rock; otherwise only the aim sees it. */
  solid: boolean
  /** Half extents of the box inside the rounding, meters. */
  halfExtents: [number, number, number]
  borderRadius: number
  translation: [number, number, number]
  /** Quaternion (x, y, z, w). */
  rotation: [number, number, number, number]
}

/** Rounding radius as a fraction of the smallest half extent. */
const ROUNDING = 0.3

/** Rounded boxes for every deposit and for the ore it leaves, tilted and turned with the deposit. */
export function depositColliderShapes(deposits: readonly Deposit[]): DepositColliderShape[] {
  const shapes: DepositColliderShape[] = []
  const rotation = new Quaternion()
  const offset = new Vector3()
  const add = (deposit: Deposit, feature: SiteFeature, box: DepositBox) => {
    depositRotation(deposit, rotation)
    offset.set(0, box.centerY, 0).applyQuaternion(rotation)
    const [hx, hy, hz] = box.halfExtents
    const border = Math.min(hx, hy, hz) * ROUNDING
    shapes.push({
      deposit,
      feature,
      solid: box.solid,
      halfExtents: [hx - border, hy - border, hz - border],
      borderRadius: border,
      translation: [deposit.x + offset.x, deposit.y + offset.y, deposit.z + offset.z],
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    })
  }
  for (const deposit of deposits) {
    const shape = getResource(deposit.resourceId)?.appearance.shape
    if (!shape) continue
    add(deposit, 'deposit', depositBox(deposit, shape))
    add(deposit, 'ore', DROP_BOX)
  }
  return shapes
}
