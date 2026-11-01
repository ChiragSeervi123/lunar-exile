import { useSettingsStore } from '@/stores/settingsStore'

type SoundDef =
  /** A file under /public/audio; null = not authored yet. */
  | { kind: 'file'; url: string | null }
  /** A short synthesised tone sweeping from `from` to `to` Hz. */
  | { kind: 'tone'; wave: OscillatorType; from: number; to: number; duration: number; gain: number }
  /** A burst of filtered noise, with an optional falling tone underneath for weight. */
  | {
      kind: 'noise'
      filter: BiquadFilterType
      frequency: number
      duration: number
      gain: number
      thump?: { from: number; to: number; gain: number }
    }
  /** Short sine notes one after another, in Hz. */
  | { kind: 'chime'; notes: number[]; spacing: number; duration: number; gain: number }

export const SOUNDS = {
  uiHover: { kind: 'tone', wave: 'sine', from: 1240, to: 1560, duration: 0.07, gain: 0.035 },
  uiConfirm: { kind: 'tone', wave: 'triangle', from: 420, to: 840, duration: 0.2, gain: 0.08 },
  uiBack: { kind: 'tone', wave: 'triangle', from: 620, to: 330, duration: 0.16, gain: 0.06 },
  /** Chips flying off a deposit under the beam. */
  mineChip: { kind: 'noise', filter: 'bandpass', frequency: 3200, duration: 0.06, gain: 0.05 },
  depositBreak: {
    kind: 'noise',
    filter: 'lowpass',
    frequency: 900,
    duration: 0.45,
    gain: 0.16,
    thump: { from: 140, to: 45, gain: 0.22 },
  },
  collect: { kind: 'chime', notes: [880, 1320], spacing: 0.07, duration: 0.22, gain: 0.06 },
  /** A rarer find gets a longer chime. */
  collectRare: { kind: 'chime', notes: [880, 1320, 1760], spacing: 0.08, duration: 0.3, gain: 0.06 },
  storageFull: { kind: 'tone', wave: 'square', from: 220, to: 180, duration: 0.18, gain: 0.035 },
  shoot: { kind: 'file', url: null },
  hit: { kind: 'file', url: null },
} satisfies Record<string, SoundDef>

export type SoundId = keyof typeof SOUNDS

let context: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

/** Browsers only allow audio after a user gesture, so the context is created on the first one. */
export function initAudio(): void {
  const unlock = () => {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function effectsVolume(): number {
  const { masterVolume, sfxVolume } = useSettingsStore.getState()
  return masterVolume * sfxVolume
}

/** One second of white noise, made once and shared by every noise sound. */
function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const samples = noiseBuffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

/** A tone with a quick attack and exponential release. */
function tone(ctx: AudioContext, wave: OscillatorType, from: number, to: number, start: number, duration: number, level: number) {
  const end = start + duration
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = wave
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(to, end)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(level, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

export function playSound(id: SoundId): void {
  const volume = effectsVolume()
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
  const ctx = context
  const start = ctx.currentTime
  switch (def.kind) {
    case 'tone':
      tone(ctx, def.wave, def.from, def.to, start, def.duration, def.gain * volume)
      break
    case 'chime':
      def.notes.forEach((note, i) => tone(ctx, 'sine', note, note * 1.002, start + i * def.spacing, def.duration, def.gain * volume))
      break
    case 'noise': {
      const end = start + def.duration
      const source = ctx.createBufferSource()
      source.buffer = noise(ctx)
      const filter = ctx.createBiquadFilter()
      filter.type = def.filter
      filter.frequency.value = def.frequency
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(def.gain * volume, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      source.connect(filter).connect(gain).connect(ctx.destination)
      // A random offset into the shared buffer, so repeats don't sound identical.
      source.start(start, Math.random() * 0.5, def.duration + 0.02)
      if (def.thump) tone(ctx, 'sine', def.thump.from, def.thump.to, start, def.duration, def.thump.gain * volume)
      break
    }
  }
}

/** The mining beam's hum while it runs: a low buzz and filtered hiss, wobbling slightly. */
interface BeamVoice {
  gain: GainNode
  sources: AudioScheduledSourceNode[]
}

let beam: BeamVoice | null = null

/** Starts or stops the mining beam's sound, fading in and out. */
export function setBeamSound(on: boolean): void {
  if (!on) {
    if (!beam || !context) return
    const voice = beam
    beam = null
    const now = context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.04)
    for (const source of voice.sources) source.stop(now + 0.25)
    return
  }
  const volume = effectsVolume()
  if (beam || volume <= 0 || context?.state !== 'running') return
  const ctx = context
  const now = ctx.currentTime
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.setTargetAtTime(0.05 * volume, now, 0.05)
  gain.connect(ctx.destination)

  const buzz = ctx.createOscillator()
  buzz.type = 'sawtooth'
  buzz.frequency.value = 96
  const muffle = ctx.createBiquadFilter()
  muffle.type = 'lowpass'
  muffle.frequency.value = 520
  buzz.connect(muffle).connect(gain)

  const hiss = ctx.createBufferSource()
  hiss.buffer = noise(ctx)
  hiss.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400
  band.Q.value = 0.8
  const hissLevel = ctx.createGain()
  hissLevel.gain.value = 0.55
  hiss.connect(band).connect(hissLevel).connect(gain)

  // A slow wobble on the buzz filter keeps the hum alive.
  const wobble = ctx.createOscillator()
  wobble.frequency.value = 7
  const depth = ctx.createGain()
  depth.gain.value = 140
  wobble.connect(depth).connect(muffle.frequency)

  const sources = [buzz, hiss, wobble]
  for (const source of sources) source.start(now)
  beam = { gain, sources }
}
