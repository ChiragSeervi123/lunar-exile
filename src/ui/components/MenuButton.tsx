import { playSound } from '@/audio/audioManager'
import { cx } from '@/utils/cx'

interface MenuButtonProps {
  label: string
  onSelect: () => void
  /** Small index shown before the label, e.g. "01". */
  index?: string
  disabled?: boolean
  /** Shown beside the label while disabled, e.g. why it is unavailable. */
  note?: string
  /** Highlighted, e.g. while the panel it opened is showing. */
  active?: boolean
  /** Entrance animation delay, ms. */
  delay?: number
}

/** A text-only menu entry: hover and focus extend a rule and brighten the label. */
export function MenuButton({ label, onSelect, index, disabled, note, active, delay = 0 }: MenuButtonProps) {
  const lit = active && !disabled
  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => {
        playSound('uiConfirm')
        onSelect()
      }}
      onMouseEnter={() => !disabled && playSound('uiHover')}
      style={{ animationDelay: `${delay}ms` }}
      className={cx(
        'group relative flex w-full animate-fade-up items-center gap-4 py-2.5 text-left font-ui outline-none',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      {index && (
        <span
          className={cx(
            'w-6 text-xs font-semibold tracking-[0.2em] transition-colors duration-300',
            disabled && 'text-lunar-700',
            !disabled && (lit ? 'text-earth-300' : 'text-lunar-500 group-hover:text-earth-300 group-focus-visible:text-earth-300'),
          )}
        >
          {index}
        </span>
      )}
      <span
        aria-hidden
        className={cx(
          'h-px transition-all duration-500 ease-out-expo',
          disabled && 'w-3 bg-lunar-700',
          !disabled &&
            (lit
              ? 'w-10 bg-earth-300'
              : 'w-3 bg-lunar-500/70 group-hover:w-10 group-hover:bg-earth-300 group-focus-visible:w-10 group-focus-visible:bg-earth-300'),
        )}
      />
      <span
        className={cx(
          'text-lg font-semibold tracking-[0.32em] transition-all duration-500 ease-out-expo sm:text-xl',
          disabled && 'text-lunar-500/45',
          !disabled &&
            (lit
              ? 'translate-x-1.5 text-lunar-50'
              : 'text-lunar-300 group-hover:translate-x-1.5 group-hover:text-lunar-50 group-focus-visible:translate-x-1.5 group-focus-visible:text-lunar-50'),
        )}
      >
        {label}
      </span>
      {disabled && note && (
        <span className="ml-1 text-[10px] font-semibold tracking-[0.3em] text-lunar-500/70">{note}</span>
      )}
    </button>
  )
}
