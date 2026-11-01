import { useSettingsStore } from '@/stores/settingsStore'

/** Sound id -> file URL under /public/audio. null = not authored yet. */
export const SOUNDS = {
  mine: null,
  shoot: null,
  hit: null,
  uiClick: null,
} satisfies Record<string, string | null>

export type SoundId = keyof typeof SOUNDS

export function playSound(id: SoundId): void {
  const url = SOUNDS[id]
  if (!url) return
  const audio = new Audio(url)
  audio.volume = useSettingsStore.getState().masterVolume
  void audio.play()
}
