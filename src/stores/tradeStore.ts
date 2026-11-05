import { create } from 'zustand'

/**
 * The lander's trade terminal, for the UI: whether the astronaut is close enough to use it, and
 * requests to open it (made by the scene, carried out by the session, which owns phase changes
 * and mouse capture). Per-frame distances live in `tradeRuntime`.
 */
interface TradeState {
  /** Within reach of the terminal while playing. */
  near: boolean
  /** Bumped each time the interact key is pressed at the terminal. */
  openRequests: number
  requestOpen: () => void
}

export const useTradeStore = create<TradeState>((set) => ({
  near: false,
  openRequests: 0,
  requestOpen: () => set((s) => ({ openRequests: s.openRequests + 1 })),
}))

/** Where the lander is from the astronaut, updated every frame for the HUD's guide. Never saved. */
export const tradeRuntime = {
  /** Straight-line distance from the astronaut to the lander, meters; Infinity with no astronaut. */
  distance: Number.POSITIVE_INFINITY,
  /** Direction to the lander, radians clockwise from the astronaut's north. */
  bearing: 0,
}
