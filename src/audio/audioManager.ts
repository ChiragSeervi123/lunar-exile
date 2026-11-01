import { useSettingsStore } from '@/stores/settingsStore'

type SoundDef =
  /** A file under /public/audio; null = not authored yet. */
  | { kind: 'file'; url: string | null }
  /** A short synthesised tone sweeping from `from` to `to` Hz. */
  | { kind: 'tone'; wave: OscillatorType; from: number; to: number; duration: number; gain: number }

export const SOUNDS = {
  uiHover: { kind: 'tone', wave: 'sine', from: 1240, to: 1560, duration: 0.07, gain: 0.035 },
  uiConfirm: { kind: 'tone', wave: 'triangle', from: 420, to: 840, duration: 0.2, gain: 0.08 },
  uiBack: { kind: 'tone', wave: 'triangle', from: 620, to: 330, duration: 0.16, gain: 0.06 },
  mine: { kind: 'file', url: null },
  shoot: { kind: 'file', url: null },
  hit: { kind: 'file', url: null },
} satisfies Record<string, SoundDef>

export type SoundId = keyof typeof SOUNDS

let context: AudioContext | null = null

/** Browsers only allow audio after a user gesture, so the context is created on the first one. */
export function initAudio(): void {
  const unlock = () => {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

export function playSound(id: SoundId): void {
  const { masterVolume, sfxVolume } = useSettingsStore.getState()
  const volume = masterVolume * sfxVolume
  const def: SoundDef = SOUNDS[id]
  if (volume <= 0) return

  if (def.kind === 'file') {
    if (!def.url) return
    const audio = new Audio(def.url)
    audio.volume = volume
    audio.play().catch(() => {})
    return
  }

  if (context?.state !== 'running') return
  const start = context.currentTime
  const end = start + def.duration
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = def.wave
  oscillator.frequency.setValueAtTime(def.from, start)
  oscillator.frequency.exponentialRampToValueAtTime(def.to, end)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(def.gain * volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}
