import { clamp } from '@/utils/math'

interface StatBarProps {
  label: string
  value: number
  max: number
  /** Tailwind background class for the fill. */
  colorClass: string
}

export function StatBar({ label, value, max, colorClass }: StatBarProps) {
  const pct = max > 0 ? clamp(value / max, 0, 1) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs text-slate-200">
      <span className="w-14 uppercase tracking-wider">{label}</span>
      <div className="h-2 w-40 overflow-hidden rounded bg-slate-800/80">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
