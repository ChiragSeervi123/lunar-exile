import { useState } from 'react'
import { cx } from '@/utils/cx'
import { MenuButton } from '../components/MenuButton'
import { moveMenuFocus } from '../components/menuNavigation'
import { usePresence } from '../hooks/usePresence'
import { SettingsPanel } from './SettingsPanel'

interface PauseMenuProps {
  leaving: boolean
  onResume: () => void
  onExit: () => void
}

export function PauseMenu({ leaving, onResume, onExit }: PauseMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settings = usePresence(settingsOpen ? true : null, 320)

  return (
    <div
      className={cx(
        'absolute inset-0 z-30 select-none bg-ink-950/60 transition-opacity duration-300',
        leaving ? 'pointer-events-none opacity-0' : 'animate-fade-in',
      )}
      style={{ animationDuration: '300ms' }}
    >
      <div className="flex h-full flex-col justify-center px-6 sm:px-12 lg:px-[7vw]">
        <p className="animate-fade-up font-ui text-[11px] font-semibold tracking-[0.45em] text-earth-300/80">
          SIMULATION SUSPENDED
        </p>
        <h2 className="mt-4 animate-fade-up font-display text-3xl tracking-[0.3em] text-lunar-50 sm:text-4xl">
          PAUSED
        </h2>
        <nav aria-label="Pause menu" className="mt-10 flex max-w-sm flex-col" onKeyDown={moveMenuFocus}>
          <MenuButton index="01" label="RESUME" onSelect={onResume} delay={60} />
          <MenuButton
            index="02"
            label="SETTINGS"
            onSelect={() => setSettingsOpen(true)}
            active={settingsOpen}
            delay={120}
          />
          <MenuButton index="03" label="MAIN MENU" onSelect={onExit} delay={180} />
        </nav>
      </div>
      {settings.value && <SettingsPanel onClose={() => setSettingsOpen(false)} leaving={settings.leaving} />}
    </div>
  )
}
