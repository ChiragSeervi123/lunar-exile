import type { ResourceDef, ToolDef } from '@/types/content'
import type { Deposit } from './deposits'

/** Deposit health removed per second when `tool` works a deposit of `resource`. */
export function miningRate(tool: ToolDef, resource: ResourceDef): number {
  return tool.power / resource.hardness
}

/** Seconds of continuous mining to break a full deposit. */
export function timeToMine(deposit: Deposit, tool: ToolDef, resource: ResourceDef): number {
  return deposit.maxHealth / miningRate(tool, resource)
}

/**
 * Applies `dt` seconds of mining to a deposit's remaining health, tracked in `health` (a missing
 * entry means untouched, at full health). `broke` is true on exactly one call: the one that takes
 * the deposit to zero.
 */
export function mineDeposit(
  health: Map<string, number>,
  deposit: Deposit,
  rate: number,
  dt: number,
): { remaining: number; broke: boolean } {
  const before = health.get(deposit.id) ?? deposit.maxHealth
  if (before <= 0) return { remaining: 0, broke: false }
  const remaining = Math.max(0, before - rate * Math.max(0, dt))
  health.set(deposit.id, remaining)
  return { remaining, broke: remaining === 0 }
}
