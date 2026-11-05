import { create } from 'zustand'

/** A banner across the middle of the screen: arriving somewhere, or finding it for the first time. */
export interface Banner {
  /** Changes with every banner, so the same text can show again. */
  key: number
  /** Small line above the title, e.g. "ENTERING" or "NEW DISCOVERY". */
  kicker: string
  title: string
  text: string
  /** A first discovery is highlighted. */
  discovery: boolean
  /** The first banner of a session, shown once the camera has flown down from the menu. */
  arrival: boolean
}

interface ExplorationState {
  /** Provinces the astronaut has been in, by id. */
  provinces: string[]
  /** Craters, structures and caves found, by id. */
  sites: string[]
  banner: Banner | null
  /** Records a province as visited; true the first time. */
  discoverProvince: (id: string) => boolean
  /** Records a site as found; true the first time. */
  discoverSite: (id: string) => boolean
  showBanner: (banner: Omit<Banner, 'key'>) => void
  /** Back to a new game's state (nothing found). */
  reset: () => void
}

let nextKey = 1

export const useExplorationStore = create<ExplorationState>((set, get) => ({
  provinces: [],
  sites: [],
  banner: null,
  discoverProvince: (id) => {
    if (get().provinces.includes(id)) return false
    set({ provinces: [...get().provinces, id] })
    return true
  },
  discoverSite: (id) => {
    if (get().sites.includes(id)) return false
    set({ sites: [...get().sites, id] })
    return true
  },
  showBanner: (banner) => set({ banner: { ...banner, key: nextKey++ } }),
  reset: () => set({ provinces: [], sites: [], banner: null }),
}))
