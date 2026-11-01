import { playSound } from '@/audio/audioManager'
import { cx } from '@/utils/cx'

interface SegmentedControlProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** A row of mutually exclusive options, marked with an underline. */
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid border border-lunar-700/70"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return
              playSound('uiConfirm')
              onChange(option.value)
            }}
            onMouseEnter={() => !selected && playSound('uiHover')}
            className={cx(
              'relative py-3 font-ui text-sm font-semibold uppercase tracking-[0.3em] outline-none transition-colors duration-300 focus-visible:bg-lunar-100/5',
              selected ? 'bg-lunar-100/[0.07] text-lunar-50' : 'text-lunar-500 hover:text-lunar-200',
            )}
          >
            {option.label}
            <span
              aria-hidden
              className={cx(
                'absolute inset-x-4 bottom-0 h-px bg-earth-300 transition-transform duration-500 ease-out-expo',
                selected ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
