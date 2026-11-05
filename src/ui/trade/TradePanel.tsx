import { Coins, Lock, PackageOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { playSound } from '@/audio/audioManager'
import { actionLabel } from '@/config/input'
import { CONFIRM_SALE_OVER } from '@/config/trade'
import { ITEMS, getItem } from '@/data/items'
import { SHOP_CATEGORIES, SHOP_OFFERS, type ShopOffer } from '@/data/market'
import { RARITIES } from '@/data/rarities'
import { getTool } from '@/data/tools'
import { offerStatus, saleValue, unitPrice } from '@/game/economy/trade'
import { MARKET } from '@/game/economy/market'
import type { InventoryStack } from '@/game/inventory'
import { useEconomyStore } from '@/stores/economyStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { cx } from '@/utils/cx'
import { Panel } from '../components/Panel'
import { ItemIcon } from '../inventory/itemIcons'

const ITEM_ORDER = Object.keys(ITEMS)
const lc = (n: number) => `${n.toLocaleString('en-US')} LC`

/** What happened when the player sold or bought something, for the feedback line. */
export interface TradeOutcome {
  ok: boolean
  message: string
}

export interface TradePanelProps {
  leaving: boolean
  onClose: () => void
  onSell: (itemId: string, quantity: number) => TradeOutcome
  onSellAll: () => TradeOutcome
  onBuy: (offerId: string) => TradeOutcome
  onEquip: (toolId: string) => TradeOutcome
}

type Tab = 'sell' | 'shop'

function Button({ children, onClick, disabled, tone = 'plain', label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'plain' | 'amber'; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'border px-3 py-1.5 text-[11px] font-semibold tracking-[0.25em] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        tone === 'amber'
          ? 'border-amber-400/60 text-amber-200 hover:bg-amber-400/15 focus-visible:bg-amber-400/15'
          : 'border-lunar-600 text-lunar-100 hover:bg-lunar-100/10 focus-visible:bg-lunar-100/10',
      )}
    >
      {children}
    </button>
  )
}

function SellRow({ stack, onSell }: { stack: InventoryStack; onSell: TradePanelProps['onSell'] }) {
  const item = getItem(stack.itemId)
  const [quantity, setQuantity] = useState(stack.quantity)
  if (!item) return null
  const rarity = RARITIES[item.rarity]
  const price = unitPrice(MARKET, stack.itemId)
  const amount = Math.max(1, Math.min(stack.quantity, Math.floor(quantity) || 1))
  return (
    <li className="border border-lunar-700/50 bg-ink-900/60 p-4" data-item={stack.itemId}>
      <div className="flex gap-4">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center border"
          style={{ color: rarity.color, borderColor: `${rarity.color}66`, background: `${rarity.color}14` }}
        >
          <ItemIcon id={stack.itemId} size={18} strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[14px] font-semibold tracking-[0.1em] text-lunar-50">{item.name.toUpperCase()}</p>
            <p className="shrink-0 text-base font-semibold tabular-nums text-lunar-50">×{stack.quantity}</p>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold tracking-[0.2em] text-lunar-400">
            {price === null ? 'NOT FOR SALE' : `${lc(price)} EACH · ${lc(saleValue(MARKET, stack.itemId, stack.quantity) ?? 0)} FOR ALL`}
          </p>
        </div>
      </div>
      {price !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-lunar-400">
            QTY
            <input
              type="number"
              min={1}
              max={stack.quantity}
              value={amount}
              aria-label={`Quantity of ${item.name} to sell`}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20 border border-lunar-700 bg-ink-950 px-2 py-1 text-[13px] tabular-nums text-lunar-50 outline-none focus:border-amber-400/70"
            />
          </label>
          <Button tone="amber" label={`Sell ${amount} ${item.name}`} onClick={() => onSell(stack.itemId, amount)}>
            SELL · {lc(price * amount)}
          </Button>
          <Button label={`Sell all ${item.name}`} onClick={() => onSell(stack.itemId, stack.quantity)}>
            ALL
          </Button>
        </div>
      )}
    </li>
  )
}

function SellTab({ onSell, onSellAll }: Pick<TradePanelProps, 'onSell' | 'onSellAll'>) {
  const stacks = useInventoryStore((s) => s.stacks)
  const [confirming, setConfirming] = useState(false)
  const sorted = useMemo(() => [...stacks].sort((a, b) => ITEM_ORDER.indexOf(a.itemId) - ITEM_ORDER.indexOf(b.itemId)), [stacks])
  const total = stacks.reduce((sum, s) => sum + (saleValue(MARKET, s.itemId, s.quantity) ?? 0), 0)
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center border border-dashed border-lunar-700/70 px-6 py-10 text-center">
        <PackageOpen size={28} strokeWidth={1.25} className="text-lunar-500" aria-hidden />
        <p className="mt-4 text-[13px] font-semibold tracking-[0.3em] text-lunar-200">NOTHING TO SELL</p>
        <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-lunar-400">Mine deposits or dig cave rock, then bring the haul back here.</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {sorted.map((stack) => (
          // Keyed by quantity too, so the quantity box resets after a sale.
          <SellRow key={`${stack.itemId}:${stack.quantity}`} stack={stack} onSell={onSell} />
        ))}
      </ul>
      {total > 0 &&
        (confirming ? (
          <div className="border border-amber-400/40 bg-amber-400/[0.06] p-4" role="alertdialog" aria-label="Confirm sale">
            <p className="text-[12px] font-semibold tracking-[0.2em] text-amber-200">SELL EVERYTHING FOR {lc(total)}?</p>
            <div className="mt-3 flex gap-2">
              <Button
                tone="amber"
                onClick={() => {
                  setConfirming(false)
                  onSellAll()
                }}
              >
                CONFIRM
              </Button>
              <Button onClick={() => setConfirming(false)}>CANCEL</Button>
            </div>
          </div>
        ) : (
          <Button tone="amber" onClick={() => (total >= CONFIRM_SALE_OVER ? setConfirming(true) : onSellAll())}>
            SELL EVERYTHING · {lc(total)}
          </Button>
        ))}
    </div>
  )
}

function OfferCard({ offer, onBuy, onEquip }: { offer: ShopOffer } & Pick<TradePanelProps, 'onBuy' | 'onEquip'>) {
  const credits = useEconomyStore((s) => s.credits)
  const tools = useEconomyStore((s) => s.tools)
  const levels = useEconomyStore((s) => s.upgradeLevels)
  const equipped = useInventoryStore((s) => s.equipment.tool)
  const status = offerStatus({ credits, stacks: [], tools, levels }, offer, SHOP_OFFERS)
  const owned = offer.kind === 'tool' && status.complete
  const needs = status.missing.map((id) => SHOP_OFFERS.find((o) => o.id === id)?.name ?? id)
  return (
    <li className="border border-lunar-700/50 bg-ink-900/60 p-4" data-offer={offer.id}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-semibold tracking-[0.1em] text-lunar-50">{offer.name.toUpperCase()}</p>
        <p className="shrink-0 text-[12px] font-semibold tabular-nums tracking-[0.15em] text-amber-200">
          {status.price === null ? (owned ? 'OWNED' : 'MAX') : lc(status.price)}
        </p>
      </div>
      {offer.kind === 'upgrade' && (
        <p className="mt-0.5 text-[11px] font-semibold tracking-[0.25em] text-lunar-400">
          LEVEL {status.level} / {status.maxLevel}
        </p>
      )}
      <p className="mt-2 text-[13px] leading-snug text-lunar-300">{offer.description}</p>
      <p className="mt-1 text-[12px] leading-snug text-amber-200/80">{offer.effect}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {needs.length > 0 ? (
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-lunar-400">
            <Lock size={12} aria-hidden /> REQUIRES {needs.join(', ').toUpperCase()}
          </p>
        ) : (
          !status.complete && (
            <Button tone="amber" disabled={!status.affordable} onClick={() => onBuy(offer.id)} label={`Buy ${offer.name}`}>
              {status.affordable ? 'BUY' : 'NOT ENOUGH LC'}
            </Button>
          )
        )}
        {owned &&
          (equipped === offer.grants ? (
            <p className="text-[11px] font-semibold tracking-[0.25em] text-amber-300">EQUIPPED</p>
          ) : (
            <Button onClick={() => onEquip(offer.grants)} label={`Equip ${offer.name}`}>
              EQUIP
            </Button>
          ))}
      </div>
    </li>
  )
}

/** The standard beam, always owned, so the player can switch back to it. */
function StandardTool({ onEquip }: Pick<TradePanelProps, 'onEquip'>) {
  const equipped = useInventoryStore((s) => s.equipment.tool)
  const tool = getTool('basic-mining-tool')
  if (!tool) return null
  return (
    <li className="flex items-center justify-between gap-3 border border-lunar-700/50 bg-ink-900/60 p-4" data-offer="basic-mining-tool">
      <div>
        <p className="text-[14px] font-semibold tracking-[0.1em] text-lunar-50">{tool.name.toUpperCase()}</p>
        <p className="mt-0.5 text-[11px] font-semibold tracking-[0.2em] text-lunar-400">
          POWER {tool.power} · REACH {tool.range} M
        </p>
      </div>
      {equipped === 'basic-mining-tool' ? (
        <p className="text-[11px] font-semibold tracking-[0.25em] text-amber-300">EQUIPPED</p>
      ) : (
        <Button onClick={() => onEquip('basic-mining-tool')} label={`Equip ${tool.name}`}>
          EQUIP
        </Button>
      )}
    </li>
  )
}

function ShopTab({ onBuy, onEquip }: Pick<TradePanelProps, 'onBuy' | 'onEquip'>) {
  return (
    <div className="flex flex-col gap-7">
      {SHOP_CATEGORIES.map((category) => (
        <section key={category.id}>
          <p className="text-[11px] font-semibold tracking-[0.4em] text-lunar-400">{category.label.toUpperCase()}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {category.id === 'tools' && <StandardTool onEquip={onEquip} />}
            {SHOP_OFFERS.filter((o) => o.category === category.id).map((offer) => (
              <OfferCard key={offer.id} offer={offer} onBuy={onBuy} onEquip={onEquip} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The lander's trade terminal: sell the haul for Lunar Credits, buy and equip gear. */
export function TradePanel({ leaving, onClose, onSell, onSellAll, onBuy, onEquip }: TradePanelProps) {
  const credits = useEconomyStore((s) => s.credits)
  const [tab, setTab] = useState<Tab>('sell')
  const [outcome, setOutcome] = useState<TradeOutcome | null>(null)
  // Every action reports back on the feedback line, with a sound for success or refusal.
  const report = (result: TradeOutcome) => {
    setOutcome(result)
    playSound(result.ok ? 'collect' : 'storageFull')
    return result
  }

  return (
    <div className={cx('absolute inset-0 z-20 select-none font-ui', leaving && 'pointer-events-none')}>
      <div
        aria-hidden
        className={cx('absolute inset-0 bg-ink-950/30', leaving ? 'animate-hud-out' : 'animate-fade-in')}
        style={{ animationDuration: '300ms' }}
        onClick={() => {
          playSound('uiBack')
          onClose()
        }}
      />
      <Panel title="TRADE TERMINAL" eyebrow="SCOUT LANDER" onClose={onClose} leaving={leaving} tone="amber">
        <div className="flex flex-col gap-6 pb-2">
          <div className="flex items-center justify-between border border-amber-400/25 bg-amber-400/[0.04] px-4 py-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.35em] text-lunar-300">
              <Coins size={14} aria-hidden className="text-amber-300" /> BALANCE
            </p>
            <p className="text-xl font-semibold tabular-nums tracking-[0.08em] text-amber-200" data-balance={credits}>
              {lc(credits)}
            </p>
          </div>
          <div className="flex gap-2" role="tablist">
            {(['sell', 'shop'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  playSound('uiConfirm')
                  setTab(t)
                }}
                className={cx(
                  'flex-1 border px-3 py-2 text-[12px] font-semibold tracking-[0.35em] outline-none transition-colors',
                  tab === t ? 'border-amber-400/60 bg-amber-400/10 text-amber-100' : 'border-lunar-700 text-lunar-400 hover:text-lunar-100',
                )}
              >
                {t === 'sell' ? 'SELL' : 'SHOP'}
              </button>
            ))}
          </div>
          {outcome && (
            <p role="status" className={cx('text-[12px] font-semibold tracking-[0.15em]', outcome.ok ? 'text-amber-200' : 'text-red-300')}>
              {outcome.message}
            </p>
          )}
          {tab === 'sell' ? (
            <SellTab onSell={(id, q) => report(onSell(id, q))} onSellAll={() => report(onSellAll())} />
          ) : (
            <ShopTab onBuy={(id) => report(onBuy(id))} onEquip={(id) => report(onEquip(id))} />
          )}
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-[0.3em] text-lunar-500">
            <kbd className="border border-lunar-700 px-1.5 py-0.5 text-[10px] text-lunar-200">{actionLabel('pause')}</kbd>
            <span>CLOSE</span>
          </p>
        </div>
      </Panel>
    </div>
  )
}
