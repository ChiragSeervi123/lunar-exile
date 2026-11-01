import { PackageOpen } from 'lucide-react'
import { useMemo } from 'react'
import { playSound } from '@/audio/audioManager'
import { actionLabel } from '@/config/input'
import { ITEMS, getItem } from '@/data/items'
import { RARITIES } from '@/data/rarities'
import { getTool } from '@/data/tools'
import type { InventoryStack } from '@/game/inventory'
import { useInventoryStore } from '@/stores/inventoryStore'
import { clamp } from '@/utils/math'
import { cx } from '@/utils/cx'
import { Panel } from '../components/Panel'
import { ItemIcon } from './itemIcons'

const ITEM_ORDER = Object.keys(ITEMS)

function SectionLabel({ children, detail }: { children: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-[11px] font-semibold tracking-[0.4em] text-lunar-400">{children}</p>
      {detail && <p className="text-[11px] font-semibold tracking-[0.25em] text-lunar-500">{detail}</p>}
    </div>
  )
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="border border-lunar-700 px-1.5 py-0.5 font-ui text-[10px] font-semibold tracking-[0.15em] text-lunar-200">
      {children}
    </kbd>
  )
}

function EquippedTool() {
  const toolId = useInventoryStore((s) => s.equipment.tool)
  const tool = getTool(toolId)
  if (!toolId || !tool) return null
  return (
    <section>
      <SectionLabel>EQUIPPED TOOL</SectionLabel>
      <div className="mt-4 flex gap-4 border border-amber-400/25 bg-amber-400/[0.04] p-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-amber-400/40 text-amber-300">
          <ItemIcon id={toolId} size={20} strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-[0.12em] text-lunar-50">{tool.name.toUpperCase()}</p>
          <p className="mt-1 text-[13px] leading-snug text-lunar-300">{tool.description}</p>
          <p className="mt-2 text-[11px] font-semibold tracking-[0.25em] text-amber-300/90">
            POWER {tool.power} · REACH {tool.range} M
          </p>
        </div>
      </div>
    </section>
  )
}

function ItemRow({ stack }: { stack: InventoryStack }) {
  const item = getItem(stack.itemId)
  if (!item) return null
  const rarity = RARITIES[item.rarity]
  const fill = clamp(stack.quantity / item.stackSize, 0, 1)
  return (
    <li className="flex gap-4 border border-lunar-700/50 bg-ink-900/60 p-4">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center border"
        style={{ color: rarity.color, borderColor: `${rarity.color}66`, background: `${rarity.color}14` }}
      >
        <ItemIcon id={stack.itemId} size={20} strokeWidth={1.5} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[15px] font-semibold tracking-[0.1em] text-lunar-50">{item.name.toUpperCase()}</p>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-lunar-50">×{stack.quantity}</p>
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.3em]" style={{ color: rarity.color }}>
            {rarity.label.toUpperCase()}
          </p>
          <p className="text-[11px] font-semibold tabular-nums tracking-[0.15em] text-lunar-500">
            {stack.quantity} / {item.stackSize}
          </p>
        </div>
        <div className="mt-2 h-[2px] w-full bg-lunar-100/10" aria-hidden>
          <div
            className={cx('h-full', fill >= 1 ? 'bg-amber-400' : 'bg-lunar-300/60')}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-lunar-300">{item.description}</p>
      </div>
    </li>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center border border-dashed border-lunar-700/70 px-6 py-10 text-center">
      <PackageOpen size={28} strokeWidth={1.25} className="text-lunar-500" aria-hidden />
      <p className="mt-4 text-[13px] font-semibold tracking-[0.3em] text-lunar-200">NO RESOURCES YET</p>
      <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-lunar-400">
        Aim at a deposit and hold {actionLabel('mine')} to mine it, then press {actionLabel('interact')} to collect the ore.
      </p>
    </div>
  )
}

interface InventoryPanelProps {
  leaving: boolean
  onClose: () => void
}

/** The backpack: the equipped tool and every resource carried, with rarity and capacity. */
export function InventoryPanel({ leaving, onClose }: InventoryPanelProps) {
  const stacks = useInventoryStore((s) => s.stacks)
  // Always in the same order, so items don't jump around as they are collected.
  const sorted = useMemo(
    () => [...stacks].sort((a, b) => ITEM_ORDER.indexOf(a.itemId) - ITEM_ORDER.indexOf(b.itemId)),
    [stacks],
  )
  const units = stacks.reduce((sum, stack) => sum + stack.quantity, 0)

  return (
    <div className={cx('absolute inset-0 z-20 select-none font-ui', leaving && 'pointer-events-none')}>
      {/* A click beside the panel closes it and goes straight back to the game. */}
      <div
        aria-hidden
        className={cx('absolute inset-0 bg-ink-950/30', leaving ? 'animate-hud-out' : 'animate-fade-in')}
        style={{ animationDuration: '300ms' }}
        onClick={() => {
          playSound('uiBack')
          onClose()
        }}
      />
      <Panel title="INVENTORY" eyebrow="BACKPACK" onClose={onClose} leaving={leaving} tone="amber">
        <div className="flex flex-col gap-9 pb-2">
          <EquippedTool />
          <section>
            <SectionLabel detail={stacks.length > 0 ? `${stacks.length} TYPES · ${units} UNITS` : undefined}>
              RESOURCES
            </SectionLabel>
            <div className="mt-4">
              {sorted.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="flex flex-col gap-3">
                  {sorted.map((stack) => (
                    <ItemRow key={stack.itemId} stack={stack} />
                  ))}
                </ul>
              )}
            </div>
          </section>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-lunar-500">
            <Key>{actionLabel('inventory')}</Key>
            <span>OR</span>
            <Key>{actionLabel('pause')}</Key>
            <span>CLOSE</span>
          </p>
        </div>
      </Panel>
    </div>
  )
}
