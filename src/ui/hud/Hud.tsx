import { actionLabel } from '@/config/input'
import { getRegion } from '@/data/regions'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '@/utils/cx'
import { CameraModeIndicator, ControlsHint, LookHint } from './ControlHints'
import { MiningHud } from './MiningHud'
import { Notifications } from './Notifications'
import { SurvivalBars } from './SurvivalBars'

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

  return (
    <div
      className={cx(
        'pointer-events-none absolute inset-0 z-10 select-none font-ui',
        leaving ? 'animate-hud-out' : 'animate-hud-in',
      )}
    >
      <div className="absolute left-6 top-6 sm:left-10 sm:top-8">
        <p className="text-sm font-semibold tracking-[0.4em] text-lunar-100">{region.name.toUpperCase()}</p>
        <p className="mt-1 text-[11px] font-semibold tracking-[0.35em] text-lunar-500">{region.coordinates}</p>
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

      {!leaving && (
        <div className="absolute inset-x-0 top-[27%] flex animate-region-card flex-col items-center px-6 text-center">
          <div
            aria-hidden
            className="absolute inset-x-0 -inset-y-12 -z-10 bg-[radial-gradient(closest-side,rgb(2_3_9/0.55),transparent)]"
          />
          <p className="text-[11px] font-semibold tracking-[0.5em] text-earth-300/80">ENTERING REGION</p>
          <h2 className="mt-4 font-display text-2xl tracking-[0.32em] text-lunar-50 [text-shadow:0_0_30px_rgb(0_0_0/0.6)] sm:text-3xl">
            {region.name.toUpperCase()}
          </h2>
          <p className="mt-4 max-w-md text-[15px] font-medium tracking-[0.06em] text-lunar-200 [text-shadow:0_0_20px_rgb(0_0_0/0.8)]">
            {region.description}
          </p>
        </div>
      )}
    </div>
  )
}
