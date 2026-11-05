import { create } from 'zustand'

/** Most digs kept per cave; the oldest are forgotten beyond this (the ground stays dug in the meantime). */
export const MAX_DIGS_PER_CAVE = 600

/**
 * What the astronaut has dug out underground: per cave, spheres of rock removed, as flat lists of
 * [x, y, z, radius] in the cave's own frame (meters from its entrance). Saved with the game.
 */
interface CaveState {
  digs: Record<string, number[]>
  /** Removes a sphere of rock in a cave. */
  dig: (caveId: string, x: number, y: number, z: number, radius: number) => void
  reset: () => void
}

const round = (v: number) => Math.round(v * 100) / 100

export const useCaveStore = create<CaveState>((set) => ({
  digs: {},
  dig: (caveId, x, y, z, radius) =>
    set(({ digs }) => {
      const list = [...(digs[caveId] ?? []), round(x), round(y), round(z), round(radius)]
      return { digs: { ...digs, [caveId]: list.slice(-MAX_DIGS_PER_CAVE * 4) } }
    }),
  reset: () => set({ digs: {} }),
}))
