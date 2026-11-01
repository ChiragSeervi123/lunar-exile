import { playSound } from '@/audio/audioManager'
import { GRAPHICS_PRESETS, GRAPHICS_QUALITIES } from '@/config/graphics'
import { useSettingsStore } from '@/stores/settingsStore'
import { Panel } from '../components/Panel'
import { RangeSlider } from '../components/RangeSlider'
import { SegmentedControl } from '../components/SegmentedControl'

const QUALITY_OPTIONS = GRAPHICS_QUALITIES.map((value) => ({ value, label: GRAPHICS_PRESETS[value].label }))

interface SettingsPanelProps {
  onClose: () => void
  leaving?: boolean
}

export function SettingsPanel({ onClose, leaving }: SettingsPanelProps) {
  const masterVolume = useSettingsStore((s) => s.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.sfxVolume)
  const quality = useSettingsStore((s) => s.graphicsQuality)
  const { setMasterVolume, setSfxVolume, setGraphicsQuality } = useSettingsStore.getState()
  const preset = GRAPHICS_PRESETS[quality]
  const preview = () => playSound('uiConfirm')

  return (
    <Panel eyebrow="SYSTEM" title="SETTINGS" onClose={onClose} leaving={leaving}>
      <section aria-labelledby="settings-audio">
        <h3 id="settings-audio" className="font-ui text-xs font-semibold tracking-[0.45em] text-lunar-500">
          AUDIO
        </h3>
        <div className="mt-6 space-y-7">
          <RangeSlider label="MASTER VOLUME" value={masterVolume} onChange={setMasterVolume} onCommit={preview} />
          <RangeSlider label="EFFECTS VOLUME" value={sfxVolume} onChange={setSfxVolume} onCommit={preview} />
        </div>
      </section>

      <section aria-labelledby="settings-graphics" className="mt-12">
        <h3 id="settings-graphics" className="font-ui text-xs font-semibold tracking-[0.45em] text-lunar-500">
          GRAPHICS QUALITY
        </h3>
        <div className="mt-6">
          <SegmentedControl
            label="Graphics quality"
            options={QUALITY_OPTIONS}
            value={quality}
            onChange={setGraphicsQuality}
          />
        </div>
        <p className="mt-5 font-ui text-[15px] font-medium leading-relaxed text-lunar-300">{preset.description}</p>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 font-ui text-[13px]">
          <Spec term="Shadows" value={`${preset.shadowMapSize} px`} />
          <Spec term="Render scale" value={`${preset.dpr[1]}×`} />
          <Spec term="Terrain grid" value={`${preset.terrainSpacing} m`} />
          <Spec term="Stars" value={preset.starCount.toLocaleString('en-US')} />
        </dl>
      </section>

      <p className="mt-12 font-ui text-xs font-medium tracking-[0.2em] text-lunar-500">
        CHANGES ARE SAVED AUTOMATICALLY
      </p>
    </Panel>
  )
}

function Spec({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-lunar-700/50 pb-2">
      <dt className="font-semibold uppercase tracking-[0.2em] text-lunar-500">{term}</dt>
      <dd className="font-semibold tabular-nums text-lunar-200">{value}</dd>
    </div>
  )
}
