import type { LucideIcon } from 'lucide-react'
import { clamp } from '@/utils/math'

interface StatBarProps {
  label: string
  value: number
  max: number
  icon: LucideIcon
  /** CSS colour for the icon and fill. */
  color: string
}

export function StatBar({ label, value, max, icon: Icon, color }: StatBarProps) {
  const percent = max > 0 ? clamp(value / max, 0, 1) * 100 : 0
  return (
    <div className="flex items-center gap-3" role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <Icon size={14} strokeWidth={1.75} style={{ color }} aria-hidden />
      <span className="w-[4.5rem] text-[11px] font-semibold tracking-[0.3em] text-lunar-300">{label}</span>
      <div className="relative h-[3px] w-32 bg-lunar-100/10 sm:w-44">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500"
          style={{ width: `${percent}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-semibold tabular-nums text-lunar-50">{Math.round(value)}</span>
    </div>
  )
}
