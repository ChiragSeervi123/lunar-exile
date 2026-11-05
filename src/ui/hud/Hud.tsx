import { actionLabel } from '@/config/input'
import { getRegion } from '@/data/regions'
import { useExplorationStore } from '@/stores/explorationStore'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '@/utils/cx'
import { CameraModeIndicator, ControlsHint, LookHint } from './ControlHints'
import { MiningHud } from './MiningHud'
import { Notifications } from './Notifications'
import { SurvivalBars } from './SurvivalBars'
import { useLocation } from './useLocation'

function KeyHint({ action, label, className }: { action: 'pause' | 'inventory'; label: string; className?: string }) {
  return (
    <span className={cx('flex items-center gap-3', className)}>
      <kbd className="border border-lunar-700 px-1.5 py-0.5 font-ui text-[10px] tracking-[0.15em] text-lunar-200">
        {actionLabel(action)}
      </kbd>
      {label}
    </span>
  )
}

/** In-game overlay. Never captures pointer events, so the canvas stays interactive. */
export function Hud({ leaving }: { leaving: boolean }) {
  const region = getRegion(useWorldStore((s) => s.regionId))
  // Where on the Moon the astronaut is now, and where this session began (for the arrival card).
  const { current } = useLocation()
  const placeName = current?.province ?? region.name
  const placeSide = current ? (current.side === 'far' ? 'FAR SIDE' : 'NEAR SIDE') : null
  // Arriving in a province, or finding one for the first time.
  const banner = useExplorationStore((s) => s.banner)

  return (
    <div
      className={cx(
        'pointer-events-none absolute inset-0 z-10 select-none font-ui',
        leaving ? 'animate-hud-out' : 'animate-hud-in',
      )}
    >
      <div className="absolute left-6 top-6 sm:left-10 sm:top-8">
        <p className="text-sm font-semibold tracking-[0.4em] text-lunar-100">{placeName.toUpperCase()}</p>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.35em] text-lunar-500">
          {current?.coordinates ?? region.coordinates}
          {placeSide && <span className="ml-3 text-lunar-600">{placeSide}</span>}
        </p>
      </div>

      <div className="absolute right-6 top-6 flex items-center gap-5 text-[11px] font-semibold tracking-[0.3em] text-lunar-400 sm:right-10 sm:top-8">
        {/* Narrow screens keep just the pause hint, clear of the region name. */}
        <KeyHint action="inventory" label="INVENTORY" className="hidden sm:flex" />
        <KeyHint action="pause" label="PAUSE" />
      </div>

      <div className="absolute bottom-6 left-6 sm:bottom-10 sm:left-10">
        <SurvivalBars />
      </div>

      <CameraModeIndicator />
      <MiningHud />
      <Notifications />
      {!leaving && <ControlsHint />}
      <LookHint />

      {!leaving && banner && (
        <div
          key={banner.key}
          className={cx(
            'absolute inset-x-0 top-[27%] flex flex-col items-center px-6 text-center',
            banner.arrival ? 'animate-region-card' : 'animate-place-card',
          )}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 -inset-y-12 -z-10 bg-[radial-gradient(closest-side,rgb(2_3_9/0.55),transparent)]"
          />
          <p className={cx('text-[11px] font-semibold tracking-[0.5em]', banner.discovery ? 'text-amber-300' : 'text-earth-300/80')}>{banner.kicker}</p>
          <h2 className="mt-4 font-display text-2xl tracking-[0.32em] text-lunar-50 [text-shadow:0_0_30px_rgb(0_0_0/0.6)] sm:text-3xl">
            {banner.title.toUpperCase()}
          </h2>
          <p className="mt-4 max-w-md text-[15px] font-medium tracking-[0.06em] text-lunar-200 [text-shadow:0_0_20px_rgb(0_0_0/0.8)]">
            {banner.text}
          </p>
        </div>
      )}
    </div>
  )
}
