import { Euler, Quaternion, Vector3 } from 'three'
import type { Deposit } from '@/game/mining'

const euler = new Euler()
const Y = new Vector3(0, 1, 0)
const align = new Quaternion()

/** A deposit's orientation: the quaternion it carries on the Moon, else its Euler angles. */
export function depositRotation(deposit: Deposit, out: Quaternion): Quaternion {
  if (deposit.orientation) return out.fromArray(deposit.orientation)
  return out.setFromEuler(euler.set(deposit.pitch, deposit.yaw, deposit.roll, 'XZY'))
}

/** The local vertical at a deposit: away from the Moon's centre (straight up on the flat map). */
export function depositUp(deposit: Deposit, out: Vector3): Vector3 {
  return deposit.orientation ? out.set(deposit.x, deposit.y, deposit.z).normalize() : out.copy(Y)
}

/** Turns `v`, given with +Y as up, so that `up` is up instead. */
export function alongUp(v: Vector3, up: Vector3): Vector3 {
  return v.applyQuaternion(align.setFromUnitVectors(Y, up))
}
