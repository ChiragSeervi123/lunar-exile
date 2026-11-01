import { create } from 'zustand'
import type { SiteFeature } from '@/game/mining'

/** A standing deposit, or the ore it left on the ground once mined out. */
export type TargetKind = SiteFeature

export interface TargetInfo {
  depositId: string
  kind: TargetKind
  resourceId: string
  /** Within the tool's reach; farther targets are only identified. */
  inRange: boolean
  /** The backpack has no room left for this resource's item. */
  full: boolean
}

interface MiningState {
  target: TargetInfo | null
  /** The beam is cutting the target. */
  mining: boolean
}

/**
 * Low-frequency mining status for the UI, written only when it changes. Per-frame values (distance,
 * health, the beam) live in stores/runtime.ts as miningRuntime.
 */
export const useMiningStore = create<MiningState>(() => ({
  target: null,
  mining: false,
}))

/** Whether `info` already describes this target, so the store only changes when the UI must. */
export function describesTarget(
  info: TargetInfo | null,
  depositId: string | null,
  kind: TargetKind,
  inRange: boolean,
  full: boolean,
): boolean {
  if (info === null || depositId === null) return info === null && depositId === null
  return info.depositId === depositId && info.kind === kind && info.inRange === inRange && info.full === full
}
