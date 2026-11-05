import { Compass, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MINING } from '@/config/mining'
import { getItem } from '@/data/items'
import { RARITIES } from '@/data/rarities'
import { useNotificationStore, type Notice } from '@/stores/notificationStore'
import { cx } from '@/utils/cx'
import { ItemIcon } from '../inventory/itemIcons'

/** Exit animation length, ms. */
const TOAST_EXIT = 300

/** "+4 Titanium" notices down the right edge, newest last; a few at most. */
export function Notifications() {
  const notices = useNotificationStore((s) => s.notices)
  return (
    <div
      aria-live="polite"
      className="absolute right-6 top-28 flex w-64 max-w-[calc(100%-3rem)] flex-col items-end gap-2 sm:right-10 sm:top-32"
    >
      {notices.map((notice) => (
        <Toast key={notice.id} notice={notice} />
      ))}
    </div>
  )
}

function Toast({ notice }: { notice: Notice }) {
  const [leaving, setLeaving] = useState(false)
  const dismiss = useNotificationStore((s) => s.dismiss)

  // Stays up for a while after its last change (repeat pickups extend it), then fades and goes.
  useEffect(() => {
    const remaining = notice.updatedAt + MINING.notifications.duration - performance.now()
    const timer = window.setTimeout(() => setLeaving(true), Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [notice.updatedAt])
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => dismiss(notice.id), TOAST_EXIT)
    return () => window.clearTimeout(timer)
  }, [leaving, dismiss, notice.id])

  if (notice.kind === 'discovery') {
    return (
      <div
        role="status"
        className={cx(
          'flex w-full items-center gap-3 border-l-2 border-earth-300 bg-ink-950/70 py-2 pl-3 pr-4',
          leaving ? 'animate-toast-out' : 'animate-toast-in',
        )}
      >
        <Compass size={16} strokeWidth={1.75} className="shrink-0 text-earth-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-earth-300">DISCOVERED</p>
          <p className="truncate text-[13px] font-semibold tracking-[0.12em] text-lunar-100">{notice.title?.toUpperCase()}</p>
          <p className="truncate text-[11px] text-lunar-300">{notice.detail}</p>
        </div>
      </div>
    )
  }
  const item = getItem(notice.itemId)
  if (!item) return null
  const rarity = RARITIES[item.rarity]
  const full = notice.kind === 'full'
  const accent = full ? 'var(--color-amber-400)' : rarity.color
  const iconProps = { size: 16, strokeWidth: 1.75, className: 'shrink-0', style: { color: accent }, 'aria-hidden': true }

  return (
    <div
      role="status"
      className={cx(
        'flex w-full items-center gap-3 border-l-2 bg-ink-950/70 py-2 pl-3 pr-4',
        leaving ? 'animate-toast-out' : 'animate-toast-in',
      )}
      style={{ borderColor: accent }}
    >
      {full ? <TriangleAlert {...iconProps} /> : <ItemIcon id={notice.itemId} {...iconProps} />}
      {full ? (
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.3em] text-amber-300">STORAGE FULL</p>
          <p className="truncate text-[12px] text-lunar-300">
            {notice.quantity} {item.name} left on the ground
          </p>
        </div>
      ) : (
        <>
          {/* Re-keyed on change, so a repeat pickup bumps the number. */}
          <span key={notice.quantity} className="inline-block animate-bump text-base font-semibold tabular-nums text-lunar-50">
            +{notice.quantity}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-[0.12em] text-lunar-100">{item.name.toUpperCase()}</p>
            <p className="text-[10px] font-semibold tracking-[0.3em]" style={{ color: rarity.color }}>
              {rarity.label.toUpperCase()}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
