import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { playSound } from '@/audio/audioManager'
import { cx } from '@/utils/cx'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface PanelProps {
  title: string
  /** Small label above the title. */
  eyebrow?: string
  onClose: () => void
  leaving?: boolean
  children: ReactNode
}

/** Side panel that slides in from the right edge; closes on Escape. */
export function Panel({ title, eyebrow, onClose, leaving, children }: PanelProps) {
  const close = () => {
    playSound('uiBack')
    onClose()
  }
  useEscapeKey(close, !leaving)

  return (
    <aside
      role="dialog"
      aria-label={title}
      className={cx(
        'absolute inset-y-0 right-0 z-10 flex w-full flex-col border-l border-lunar-700/60 bg-ink-950/95 px-7 py-9 sm:w-[440px] sm:px-10 sm:py-12',
        leaving ? 'pointer-events-none animate-panel-out' : 'animate-panel-in',
      )}
    >
      <header className="flex items-start justify-between gap-6">
        <div>
          {eyebrow && (
            <p className="font-ui text-[11px] font-semibold tracking-[0.45em] text-earth-300/80">{eyebrow}</p>
          )}
          <h2 className="mt-3 font-display text-xl tracking-[0.28em] text-lunar-50">{title}</h2>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={`Close ${title.toLowerCase()}`}
          className="-mr-2 p-2 text-lunar-400 outline-none transition-colors hover:text-lunar-50 focus-visible:text-earth-300"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </header>
      <div className="mt-8 h-px w-full bg-linear-to-r from-lunar-700 to-transparent" />
      <div className="mt-8 flex-1 overflow-y-auto pr-1">{children}</div>
    </aside>
  )
}
