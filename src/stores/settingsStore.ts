import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_GRAPHICS_QUALITY, type GraphicsQuality } from '@/config/graphics'

interface SettingsState {
  masterVolume: number
  /** Interface and effect sounds, scaled by the master volume. */
  sfxVolume: number
  mouseSensitivity: number
  graphicsQuality: GraphicsQuality
  setMasterVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  setGraphicsQuality: (quality: GraphicsQuality) => void
}

/** Per-device preferences, persisted separately from save games. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterVolume: 0.8,
      sfxVolume: 0.7,
      mouseSensitivity: 1,
      graphicsQuality: DEFAULT_GRAPHICS_QUALITY,
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume }),
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
    }),
    { name: 'lunar-exile-settings', version: 1 },
  ),
)
