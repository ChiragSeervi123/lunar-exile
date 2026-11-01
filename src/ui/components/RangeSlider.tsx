import { useId, type CSSProperties } from 'react'

interface RangeSliderProps {
  label: string
  /** 0..1 */
  value: number
  onChange: (value: number) => void
  /** Called when the user lets go, e.g. to preview a sound at the new level. */
  onCommit?: () => void
}

export function RangeSlider({ label, value, onChange, onCommit }: RangeSliderProps) {
  const id = useId()
  const percent = Math.round(value * 100)
  return (
    <div className="font-ui">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold tracking-[0.28em] text-lunar-300">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums tracking-[0.12em] text-lunar-50">{percent}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="lunar-range mt-3"
        style={{ '--fill': `${percent}%` } as CSSProperties}
      />
    </div>
  )
}
