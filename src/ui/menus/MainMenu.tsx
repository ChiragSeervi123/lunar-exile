import { useState } from 'react'
import { playSound } from '@/audio/audioManager'
import { BUILD_LABEL } from '@/config/game'
import { getRegion } from '@/data/regions'
import { useWorldStore } from '@/stores/worldStore'
import { cx } from '@/utils/cx'
import { MenuButton } from '../components/MenuButton'
import { moveMenuFocus } from '../components/menuNavigation'
import { usePresence } from '../hooks/usePresence'
import { CreditsPanel } from './CreditsPanel'
import { SettingsPanel } from './SettingsPanel'

type PanelId = 'settings' | 'credits'

interface MainMenuProps {
  hasSave: boolean
  leaving: boolean
  onNewGame: () => void
  onContinue: () => void
}

export function MainMenu({ hasSave, leaving, onNewGame, onContinue }: MainMenuProps) {
  const [panel, setPanel] = useState<PanelId | null>(null)
  const [confirmingNewGame, setConfirmingNewGame] = useState(false)
  const shown = usePresence(panel, 320)
  const region = getRegion(useWorldStore((s) => s.regionId))

  const startNewGame = () => {
    // Starting over replaces the existing save, so ask first.
    if (hasSave && !confirmingNewGame) setConfirmingNewGame(true)
    else onNewGame()
  }

  return (
    <div className={cx('absolute inset-0 z-20 select-none', leaving && 'pointer-events-none')}>
      <div
        className={cx('menu-backdrop absolute inset-0 transition-opacity duration-[1400ms]', leaving && 'opacity-0')}
      />
      <div
        className={cx(
          'relative flex h-full flex-col justify-between px-6 py-8 transition-all duration-700 ease-out sm:px-12 sm:py-10 lg:px-[7vw] lg:py-12',
          leaving && '-translate-x-6 opacity-0 blur-[2px]',
        )}
      >
        <p className="animate-fade-in font-ui text-[11px] font-semibold tracking-[0.42em] text-lunar-500">
          {region.coordinates} <span className="mx-2 text-lunar-700">/</span> {region.name.toUpperCase()}
        </p>

        <main className="max-w-xl pb-[4vh]">
          <h1
            className="animate-title font-display text-[clamp(2.1rem,6.2vw,4.9rem)] leading-[1.05] tracking-[0.2em] text-lunar-50 [text-shadow:0_0_40px_rgb(156_198_255/0.18)]"
            style={{ animationDelay: '150ms' }}
          >
            LUNAR <br className="sm:hidden" />
            EXILE
          </h1>
          <div className="mt-6 flex items-center gap-5">
            <span
              aria-hidden
              className="h-px w-14 origin-left animate-rule bg-linear-to-r from-earth-300 to-transparent"
              style={{ animationDelay: '700ms' }}
            />
            <p
              className="animate-fade-up font-ui text-xs font-semibold tracking-[0.32em] text-lunar-300 sm:text-sm sm:tracking-[0.55em]"
              style={{ animationDelay: '800ms' }}
            >
              STRANDED BEYOND EARTH
            </p>
          </div>

          <nav aria-label="Main menu" className="mt-[7vh] flex max-w-sm flex-col" onKeyDown={moveMenuFocus}>
            <MenuButton index="01" label="NEW GAME" onSelect={startNewGame} active={confirmingNewGame} delay={1100} />
            {confirmingNewGame && (
              <div className="animate-fade-up py-2 pl-10 font-ui" role="alert">
                <p className="text-xs font-semibold tracking-[0.25em] text-lunar-400">THIS REPLACES YOUR SAVED GAME</p>
                <div className="mt-3 flex gap-6 text-sm font-semibold tracking-[0.3em]">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      playSound('uiConfirm')
                      onNewGame()
                    }}
                    className="text-earth-300 outline-none transition-colors hover:text-lunar-50 focus-visible:text-lunar-50 focus-visible:underline"
                  >
                    START OVER
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound('uiBack')
                      setConfirmingNewGame(false)
                    }}
                    className="text-lunar-500 outline-none transition-colors hover:text-lunar-200 focus-visible:text-lunar-200 focus-visible:underline"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
            <MenuButton
              index="02"
              label="CONTINUE"
              onSelect={onContinue}
              disabled={!hasSave}
              note="NO SAVE DATA"
              delay={1190}
            />
            <MenuButton
              index="03"
              label="SETTINGS"
              onSelect={() => setPanel('settings')}
              active={panel === 'settings'}
              delay={1280}
            />
            <MenuButton
              index="04"
              label="CREDITS"
              onSelect={() => setPanel('credits')}
              active={panel === 'credits'}
              delay={1370}
            />
          </nav>
        </main>

        <footer
          className="flex animate-fade-in items-end justify-between font-ui text-[11px] font-semibold tracking-[0.32em] text-lunar-500"
          style={{ animationDelay: '1600ms' }}
        >
          <span>{BUILD_LABEL.toUpperCase()}</span>
          <span className="hidden sm:block">↑ ↓ NAVIGATE · ENTER SELECT</span>
        </footer>
      </div>

      {shown.value === 'settings' && <SettingsPanel onClose={() => setPanel(null)} leaving={shown.leaving} />}
      {shown.value === 'credits' && <CreditsPanel onClose={() => setPanel(null)} leaving={shown.leaving} />}
    </div>
  )
}
