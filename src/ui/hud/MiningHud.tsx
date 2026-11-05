import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { actionLabel } from '@/config/input'
import { getItem } from '@/data/items'
import { RARITIES } from '@/data/rarities'
import { getResource } from '@/data/resources'
import { getTool } from '@/data/tools'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMiningStore, type TargetInfo } from '@/stores/miningStore'
import { miningRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '@/utils/cx'

/** Writes text only when it changed, so per-frame updates don't touch the layout needlessly. */
function setText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="border border-lunar-700 px-1.5 py-0.5 font-ui text-[10px] font-semibold tracking-[0.15em] text-lunar-100">
      {children}
    </kbd>
  )
}

/** The crosshair (both camera modes) and, when it rests on a deposit, what that deposit is. */
export function MiningHud() {
  const playing = useGameStore((s) => s.phase === 'playing')
  const target = useMiningStore((s) => s.target)
  const mining = useMiningStore((s) => s.mining)
  const wall = useMiningStore((s) => s.wall)
  if (!playing) return null
  return (
    <>
      <Reticle target={target} mining={mining} />
      {target && <TargetCard key={`${target.depositId}:${target.kind}`} target={target} mining={mining} />}
      {!target && wall && <WallCard wall={wall} mining={mining} />}
    </>
  )
}

/** A cave wall in reach: dig it like dirt for lunar dust (not right under the surface). */
function WallCard({ wall, mining }: { wall: 'dig' | 'shallow'; mining: boolean }) {
  return (
    <div className="absolute left-1/2 top-1/2 ml-10 mt-6 w-56 border-l-2 border-lunar-400/70 bg-ink-950/60 px-4 py-3">
      <p className="text-[10px] font-semibold tracking-[0.3em] text-lunar-400">CAVE WALL</p>
      <p className="mt-1 text-[13px] font-semibold tracking-[0.12em] text-lunar-100">REGOLITH ROCK</p>
      <p className="mt-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.25em] text-lunar-300">
        {wall === 'dig' ? (
          <>
            <Key>{actionLabel('mine')}</Key>
            {mining ? 'DIGGING' : 'HOLD TO DIG'}
          </>
        ) : (
          'TOO CLOSE TO THE SURFACE'
        )}
      </p>
    </div>
  )
}

/** A faint dot; a ring around it on a deposit, amber within reach, pulsing while the beam cuts. */
function Reticle({ target, mining }: { target: TargetInfo | null; mining: boolean }) {
  const ready = target?.inRange ?? false
  return (
    <>
      <div
        className={cx(
          'absolute left-1/2 top-1/2 h-1 w-1 -translate-1/2 rounded-full transition-colors',
          ready ? 'bg-amber-300' : 'bg-lunar-50/70',
        )}
      />
      {target && (
        <div
          className={cx(
            'absolute left-1/2 top-1/2 h-7 w-7 -translate-1/2 rounded-full border transition-colors',
            ready ? 'border-amber-300/90' : 'border-lunar-300/40',
            mining && 'animate-reticle-pulse',
          )}
        />
      )}
    </>
  )
}

function TargetCard({ target, mining }: { target: TargetInfo; mining: boolean }) {
  const ore = useWorldStore((s) => s.sites.drops[target.depositId] ?? 0)
  const reach = getTool(useInventoryStore((s) => s.equipment.tool))?.range ?? 0
  const { depositId, maxHealth } = target
  const distance = useRef<HTMLSpanElement>(null)
  const integrity = useRef<HTMLSpanElement>(null)
  const percent = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  // Distance and extraction change every frame: written straight to the page, not through React.
  useLayoutEffect(() => {
    let frame = 0
    const tick = () => {
      setText(distance.current, `${miningRuntime.distance.toFixed(1)} M`)
      const health = miningRuntime.health.get(depositId) ?? maxHealth
      const progress = 1 - health / maxHealth
      setText(integrity.current, `${Math.ceil(health)}/${maxHealth}`)
      setText(percent.current, `${Math.floor(progress * 100)}%`)
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [depositId, maxHealth])

  const resource = getResource(target.resourceId)
  const item = resource ? getItem(resource.itemId) : undefined
  if (!resource || !item) return null
  const rarity = RARITIES[resource.rarity]
  const isDeposit = target.kind === 'deposit'

  let hint: ReactNode
  if (!target.inRange) hint = <span className="text-lunar-400">MOVE CLOSER · REACH {reach} M</span>
  else if (isDeposit) hint = mining ? <span className="text-amber-300">EXTRACTING…</span> : <><Key>{actionLabel('mine')}</Key> HOLD TO MINE</>
  else if (target.full) hint = <span className="text-amber-400">STORAGE FULL</span>
  else hint = <><Key>{actionLabel('interact')}</Key> COLLECT ×{ore}</>

  return (
    <div
      className="absolute left-[calc(50%+2.25rem)] top-[calc(50%+1.25rem)] w-60 max-w-[calc(50%-3rem)] animate-card-in border-l-2 bg-ink-950/60 px-3.5 py-3"
      style={{ borderColor: rarity.color }}
    >
      <div className="flex items-baseline justify-between gap-3 text-[10px] font-semibold tracking-[0.3em]">
        <span className="truncate" style={{ color: rarity.color }}>
          {rarity.label.toUpperCase()}
        </span>
        <span ref={distance} className="shrink-0 tabular-nums tracking-[0.15em] text-lunar-400" />
      </div>
      <p className="mt-1 text-[15px] font-semibold leading-tight tracking-[0.14em] text-lunar-50">
        {isDeposit ? resource.name.toUpperCase() : `${item.name.toUpperCase()} ORE`}
      </p>
      {isDeposit && (
        <>
          <div className="mt-2.5 h-[3px] w-full overflow-hidden bg-lunar-100/10" role="presentation">
            <div ref={bar} className="h-full origin-left bg-amber-400" style={{ transform: 'scaleX(0)' }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold tabular-nums tracking-[0.2em] text-lunar-400">
            <span>
              INTEGRITY <span ref={integrity} className="text-lunar-200" />
            </span>
            <span ref={percent} className="text-amber-300" />
          </div>
        </>
      )}
      {isDeposit && target.full && target.inRange && (
        <p className="mt-2 text-[10px] font-semibold tracking-[0.25em] text-amber-400">STORAGE FULL · ORE WILL WAIT</p>
      )}
      <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.25em] text-lunar-200">
        {hint}
      </p>
    </div>
  )
}
