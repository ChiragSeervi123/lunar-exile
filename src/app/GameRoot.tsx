import { useEffect } from 'react'
import { KEYBINDINGS } from '@/config/input'
import { useGameStore } from '@/stores/gameStore'
import { Hud } from '@/ui/hud/Hud'
import { usePresence } from '@/ui/hooks/usePresence'
import { MainMenu } from '@/ui/menus/MainMenu'
import { PauseMenu } from '@/ui/menus/PauseMenu'
import { cx } from '@/utils/cx'
import { GameCanvas } from './GameCanvas'
import { continueGame, exitToMenu, resumeGame, startNewGame, togglePause } from './session'

/** Exit animation lengths, ms. */
const MENU_EXIT = 1400
const HUD_EXIT = 500
const PAUSE_EXIT = 300

export function GameRoot() {
  const phase = useGameStore((s) => s.phase)
  const hasSave = useGameStore((s) => s.hasSave)
  const ready = useGameStore((s) => s.sceneReady)
  const menu = usePresence(ready && phase === 'menu' ? true : null, MENU_EXIT)
  const hud = usePresence(phase !== 'menu' ? true : null, HUD_EXIT)
  const pause = usePresence(phase === 'paused' ? true : null, PAUSE_EXIT)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === KEYBINDINGS.pause && !event.defaultPrevented && !event.repeat) togglePause()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden bg-space">
      <GameCanvas />
      {hud.value && <Hud leaving={hud.leaving} />}
      {menu.value && (
        <MainMenu leaving={menu.leaving} hasSave={hasSave} onNewGame={startNewGame} onContinue={continueGame} />
      )}
      {pause.value && <PauseMenu leaving={pause.leaving} onResume={resumeGame} onExit={exitToMenu} />}
      {/* Covers world generation, then fades to reveal the scene. */}
      <div
        aria-hidden
        className={cx(
          'pointer-events-none absolute inset-0 z-40 bg-space transition-opacity duration-[1600ms] ease-out',
          ready && 'opacity-0',
        )}
      />
    </div>
  )
}
