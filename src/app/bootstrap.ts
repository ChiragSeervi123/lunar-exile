import { loadFromStorage } from '@/save/saveGame'

/** One-time startup before the first render. */
export function bootstrapGame(): void {
  loadFromStorage()
}
