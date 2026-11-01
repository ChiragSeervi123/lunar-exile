import { useId, type CSSProperties } from 'react'

interface RangeSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  /** Called when the user lets go, e.g. to preview a sound at the new level. */
  onCommit?: () => void
  min?: number
  max?: number
  step?: number
  /** Text shown beside the label; a percentage by default. */
  format?: (value: number) => string
}

const percent = (value: number) => `${Math.round(value * 100)}%`

export function RangeSlider({
  label,
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  format = percent,
}: RangeSliderProps) {
  const id = useId()
  const fill = ((value - min) / (max - min)) * 100
  return (
    <div className="font-ui">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold tracking-[0.28em] text-lunar-300">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums tracking-[0.12em] text-lunar-50">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="lunar-range mt-3"
        style={{ '--fill': `${fill}%` } as CSSProperties}
      />
    </div>
  )
}
