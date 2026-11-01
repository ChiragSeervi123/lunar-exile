import type { ResourceDef } from '@/types/content'

/**
 * What has been mined in a region, keyed by deposit id. A deposit breaks into ore left on the
 * ground; once that is collected the site starts to regrow (if its resource ever does).
 */
export interface DepositSites {
  /** Play time each mined-out deposit was cleared, seconds: when it broke, then when its ore was collected. */
  depleted: Record<string, number>
  /** Ore units waiting to be collected at mined-out deposits. */
  drops: Record<string, number>
}

/** What stands at a site: the deposit itself, or the ore it left once mined out. */
export type SiteFeature = 'deposit' | 'ore'

export function emptySites(): DepositSites {
  return { depleted: {}, drops: {} }
}

/** Whether a deposit, or the ore it left, is in the world right now. */
export function isPresent(sites: DepositSites, id: string, feature: SiteFeature): boolean {
  return feature === 'deposit' ? !(id in sites.depleted) : id in sites.drops
}

/**
 * A deposit breaking: it is mined out and leaves `quantity` units on the ground. Returns null if
 * it was already mined out, so one deposit can never pay out twice.
 */
export function breakSite(sites: DepositSites, id: string, quantity: number, playTime: number): DepositSites | null {
  if (id in sites.depleted) return null
  const drops = { ...sites.drops }
  if (Number.isSafeInteger(quantity) && quantity > 0) drops[id] = quantity
  return { depleted: { ...sites.depleted, [id]: playTime }, drops }
}

/**
 * Picking up `quantity` units of a site's ore. Taking the last unit restarts the site's regrowth
 * clock. Returns null if there is not that much ore there.
 */
export function collectFromSite(
  sites: DepositSites,
  id: string,
  quantity: number,
  playTime: number,
): DepositSites | null {
  const available = sites.drops[id] ?? 0
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > available) return null
  const drops = { ...sites.drops }
  if (quantity === available) {
    delete drops[id]
    return { depleted: { ...sites.depleted, [id]: playTime }, drops }
  }
  drops[id] = available - quantity
  return { depleted: sites.depleted, drops }
}

/** Whether a site cleared at `clearedAt` has grown back by `playTime`. Sites with ore on the ground never do. */
export function hasRegrown(sites: DepositSites, id: string, resource: ResourceDef, playTime: number): boolean {
  const clearedAt = sites.depleted[id]
  if (clearedAt === undefined || id in sites.drops || resource.respawnSeconds === null) return false
  return playTime - clearedAt >= resource.respawnSeconds
}

/** Deposits grown back: no longer mined out. */
export function regrowSites(sites: DepositSites, ids: readonly string[]): DepositSites {
  if (ids.length === 0) return sites
  const depleted = { ...sites.depleted }
  for (const id of ids) delete depleted[id]
  return { depleted, drops: sites.drops }
}

/**
 * Sites from untrusted data, such as a hand-edited save: keeps entries with sensible values. Ore
 * on the ground always belongs to a mined-out site; times never run ahead of `playTime`.
 */
export function sanitizeSites(raw: unknown, playTime: number): DepositSites {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof DepositSites, unknown>>
  const record = (value: unknown) =>
    Object.entries(typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {})
  const sites = emptySites()
  for (const [id, at] of record(source.depleted)) {
    if (typeof at === 'number' && Number.isFinite(at) && at >= 0) sites.depleted[id] = Math.min(at, playTime)
  }
  for (const [id, quantity] of record(source.drops)) {
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) continue
    sites.drops[id] = quantity
    sites.depleted[id] ??= playTime
  }
  return sites
}
