import type { Deposit } from '@/game/mining'
import type { TargetKind } from '@/stores/miningStore'

/**
 * What each deposit collider stands for, keyed by Rapier collider handle: the deposit itself, or
 * the ore it left on the ground. Filled by DepositColliders, read by the mining system's aim.
 */
export const depositTargets = new Map<number, { deposit: Deposit; kind: TargetKind }>()
