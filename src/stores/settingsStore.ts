import { create } from 'zustand'

interface SettingsState {
  masterVolume: number
  mouseSensitivity: number
}

export const useSettingsStore = create<SettingsState>(() => ({
  masterVolume: 0.8,
  mouseSensitivity: 1,
}))
