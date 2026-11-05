import { countItem, isValidQuantity, removeItem, type InventoryStack } from '@/game/inventory'

/*
 * Trading, free of UI and storage: selling resources for Lunar Credits (LC) and buying tools and
 * upgrades. Every sale and purchase goes through `applyTransaction`, which checks it completely
 * before changing anything and changes items and credits together, so a transaction either
 * happens in full or not at all. Credits and quantities are whole numbers and never negative.
 */

/** What the trade terminal sells. Prices and effects live in data/market.ts. */
export interface Offer {
  id: string
  /** A tool is bought once; an upgrade is bought level by level. */
  kind: 'tool' | 'upgrade'
  /** The tool (data/tools.ts) or upgrade (data/market.ts) it gives. */
  grants: string
  /** LC for each purchase: one price for a tool, one per level for an upgrade. */
  prices: readonly number[]
  /** Offers that must be bought first (an upgrade needs at least its first level). */
  requires?: readonly string[]
}

export interface Market {
  /** LC paid per unit of an item; null for items the terminal won't buy. */
  sellPrice(itemId: string): number | null
  offers: readonly Offer[]
}

/** Everything a trade can change. */
export interface Holdings {
  credits: number
  stacks: readonly InventoryStack[]
  /** Tools owned. */
  tools: readonly string[]
  /** Upgrade levels by upgrade id; missing means not bought. */
  levels: Readonly<Record<string, number>>
}

export type Transaction = { kind: 'sell'; itemId: string; quantity: number } | { kind: 'buy'; offerId: string }

export type TradeError =
  | 'invalid-quantity'
  | 'not-carried'
  | 'not-sellable'
  | 'insufficient-funds'
  | 'owned'
  | 'max-level'
  | 'locked'
  | 'unknown-offer'
  | 'too-many-credits'

export type TradeResult =
  | {
      ok: true
      holdings: Holdings
      /** Credits gained (positive) or spent (negative). */
      credits: number
      /** For a purchase: the tool bought, or the upgrade and its new level. */
      bought?: { offer: Offer; level: number }
    }
  | { ok: false; error: TradeError }

const fail = (error: TradeError): TradeResult => ({ ok: false, error })

/** LC an item sells for per unit: a whole number above zero, or null when it can't be sold. */
export function unitPrice(market: Market, itemId: string): number | null {
  const price = market.sellPrice(itemId)
  return price !== null && Number.isSafeInteger(price) && price > 0 ? price : null
}

/** Total LC for selling `quantity` units, or null when they can't be sold. */
export function saleValue(market: Market, itemId: string, quantity: number): number | null {
  const price = unitPrice(market, itemId)
  if (price === null || !isValidQuantity(quantity)) return null
  const total = price * quantity
  return Number.isSafeInteger(total) ? total : null
}

/** The level of an upgrade owned, or 1/0 for a tool owned or not. */
export function ownedLevel(holdings: Holdings, offer: Offer): number {
  return offer.kind === 'tool' ? (holdings.tools.includes(offer.grants) ? 1 : 0) : (holdings.levels[offer.grants] ?? 0)
}

/** Where an offer stands for the player: what the next purchase costs, and whether it's possible. */
export function offerStatus(holdings: Holdings, offer: Offer, offers: readonly Offer[]) {
  const level = ownedLevel(holdings, offer)
  const maxLevel = offer.kind === 'tool' ? 1 : offer.prices.length
  const complete = level >= maxLevel
  const next = complete ? null : offer.prices[level]
  const missing = (offer.requires ?? []).filter((id) => {
    const needed = offers.find((o) => o.id === id)
    return !needed || ownedLevel(holdings, needed) === 0
  })
  return {
    level,
    maxLevel,
    complete,
    /** LC for the next purchase; null when there's nothing left to buy. */
    price: next,
    /** Offers still to buy before this one. */
    missing,
    affordable: next !== null && holdings.credits >= next,
  }
}

/** The single path for every sale and purchase. Nothing changes unless it succeeds. */
export function applyTransaction(holdings: Holdings, tx: Transaction, market: Market): TradeResult {
  if (!Number.isSafeInteger(holdings.credits) || holdings.credits < 0) return fail('insufficient-funds')
  if (tx.kind === 'sell') {
    if (!isValidQuantity(tx.quantity)) return fail('invalid-quantity')
    const value = saleValue(market, tx.itemId, tx.quantity)
    if (value === null) return fail('not-sellable')
    if (countItem(holdings.stacks, tx.itemId) < tx.quantity) return fail('not-carried')
    const credits = holdings.credits + value
    if (!Number.isSafeInteger(credits)) return fail('too-many-credits')
    const { stacks, removed } = removeItem(holdings.stacks, tx.itemId, tx.quantity)
    if (!removed) return fail('not-carried')
    return { ok: true, holdings: { ...holdings, stacks, credits }, credits: value }
  }
  const offer = market.offers.find((o) => o.id === tx.offerId)
  if (!offer) return fail('unknown-offer')
  const status = offerStatus(holdings, offer, market.offers)
  if (status.complete) return fail(offer.kind === 'tool' ? 'owned' : 'max-level')
  if (status.missing.length > 0) return fail('locked')
  const price = status.price!
  if (!Number.isSafeInteger(price) || price < 0) return fail('unknown-offer')
  if (holdings.credits < price) return fail('insufficient-funds')
  const level = status.level + 1
  const next: Holdings =
    offer.kind === 'tool'
      ? { ...holdings, credits: holdings.credits - price, tools: [...holdings.tools, offer.grants] }
      : { ...holdings, credits: holdings.credits - price, levels: { ...holdings.levels, [offer.grants]: level } }
  return { ok: true, holdings: next, credits: -price, bought: { offer, level } }
}

/** Sells every sellable item carried, as one transaction: all of it, or (on any failure) none. */
export function sellAll(holdings: Holdings, market: Market): TradeResult {
  let current = holdings
  let total = 0
  for (const stack of holdings.stacks) {
    if (unitPrice(market, stack.itemId) === null) continue
    const result = applyTransaction(current, { kind: 'sell', itemId: stack.itemId, quantity: stack.quantity }, market)
    if (!result.ok) return result
    current = result.holdings
    total += result.credits
  }
  return total > 0 ? { ok: true, holdings: current, credits: total } : fail('not-carried')
}
