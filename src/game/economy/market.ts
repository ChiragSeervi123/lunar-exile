import { SELL_PRICES, SHOP_OFFERS } from '@/data/market'
import type { Market } from './trade'

/** The lander's trade terminal, from the data in data/market.ts. */
export const MARKET: Market = {
  sellPrice: (itemId) => (SELL_PRICES as Record<string, number | null>)[itemId] ?? null,
  offers: SHOP_OFFERS,
}
