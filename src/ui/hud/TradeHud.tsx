import { Coins, Navigation2 } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { actionLabel } from '@/config/input'
import { LANDER } from '@/config/trade'
import { useEconomyStore } from '@/stores/economyStore'
import { cameraRuntime } from '@/stores/runtime'
import { tradeRuntime, useTradeStore } from '@/stores/tradeStore'

/** The Lunar Credits balance, under the key hints in the top right. */
export function CreditsReadout() {
  const credits = useEconomyStore((s) => s.credits)
  return (
    <p className="flex items-center justify-end gap-2 text-[12px] font-semibold tabular-nums tracking-[0.2em] text-amber-200" data-credits={credits}>
      <Coins size={13} aria-hidden className="text-amber-300" />
      {credits.toLocaleString('en-US')} LC
    </p>
  )
}

/** At the lander: how to open its trade terminal. */
export function TerminalPrompt() {
  const near = useTradeStore((s) => s.near)
  if (!near) return null
  return (
    <div className="absolute left-1/2 top-[62%] -translate-x-1/2 border-l-2 border-amber-400/70 bg-ink-950/60 px-4 py-3" data-terminal-prompt>
      <p className="text-[10px] font-semibold tracking-[0.3em] text-amber-300">SCOUT LANDER</p>
      <p className="mt-1.5 flex items-center gap-2 text-[12px] font-semibold tracking-[0.25em] text-lunar-100">
        <kbd className="border border-lunar-700 px-1.5 py-0.5 text-[10px] tracking-[0.15em] text-lunar-100">{actionLabel('interact')}</kbd>
        TRADE TERMINAL
      </p>
    </div>
  )
}

/**
 * Far from the lander, which way it is and how far: an arrow turned to it relative to the view.
 * Written straight to the page every frame, not through React.
 */
export function LanderGuide() {
  const root = useRef<HTMLParagraphElement>(null)
  const arrow = useRef<HTMLSpanElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    let frame = 0
    const tick = () => {
      const d = tradeRuntime.distance
      const show = Number.isFinite(d) && d > LANDER.guideBeyond
      if (root.current) root.current.style.visibility = show ? 'visible' : 'hidden'
      if (show) {
        const text = `LANDER ${d >= 1000 ? `${(d / 1000).toFixed(1)} KM` : `${Math.round(d)} M`}`
        if (label.current && label.current.textContent !== text) label.current.textContent = text
        if (arrow.current) arrow.current.style.transform = `rotate(${tradeRuntime.bearing - cameraRuntime.yaw}rad)`
      }
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <p ref={root} className="mt-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-amber-300/80" style={{ visibility: 'hidden' }} data-lander-guide>
      <span ref={arrow} className="inline-flex" aria-hidden>
        <Navigation2 size={11} />
      </span>
      <span ref={label} />
    </p>
  )
}
