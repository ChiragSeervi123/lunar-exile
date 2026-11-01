import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { playSound } from '@/audio/audioManager'
import { cx } from '@/utils/cx'
import { useEscapeKey } from '../hooks/useEscapeKey'

/** Accent colour: blue for menus and settings, amber for gameplay panels like the inventory. */
export type PanelTone = 'earth' | 'amber'

const TONES: Record<PanelTone, { eyebrow: string; border: string; rule: string; focus: string; surface: string }> = {
  earth: {
    eyebrow: 'text-earth-300/80',
    border: 'border-lunar-700/60',
    rule: 'from-lunar-700',
    focus: 'focus-visible:text-earth-300',
    surface: 'bg-ink-950/95',
  },
  amber: {
    eyebrow: 'text-amber-300/90',
    border: 'border-amber-400/20',
    rule: 'from-amber-400/40',
    focus: 'focus-visible:text-amber-300',
    // See-through, so the world stays visible behind the backpack.
    surface: 'bg-ink-950/85',
  },
}

interface PanelProps {
  title: string
  /** Small label above the title. */
  eyebrow?: string
  onClose: () => void
  leaving?: boolean
  tone?: PanelTone
  children: ReactNode
}

/** Side panel that slides in from the right edge; closes on Escape. */
export function Panel({ title, eyebrow, onClose, leaving, tone = 'earth', children }: PanelProps) {
  const close = () => {
    playSound('uiBack')
    onClose()
  }
  useEscapeKey(close, !leaving)
  const t = TONES[tone]

  return (
    <aside
      role="dialog"
      aria-label={title}
      className={cx(
        'absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l px-7 py-9 sm:w-[440px] sm:px-10 sm:py-12',
        t.border,
        t.surface,
        leaving ? 'pointer-events-none animate-panel-out' : 'animate-panel-in',
      )}
    >
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <p className={cx('font-ui text-[11px] font-semibold tracking-[0.45em]', t.eyebrow)}>{eyebrow}</p>}
          <h2 className="mt-3 font-display text-xl tracking-[0.28em] text-lunar-50">{title}</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={`Close ${title.toLowerCase()}`}
          className={cx('-mr-2 p-2 text-lunar-400 outline-none transition-colors hover:text-lunar-50', t.focus)}
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </header>
      <div className={cx('mt-8 h-px w-full bg-linear-to-r to-transparent', t.rule)} />
      <div className="mt-8 flex-1 overflow-x-hidden overflow-y-auto pr-1">{children}</div>
    </aside>
  )
}
