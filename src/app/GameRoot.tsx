import { useGameStore } from '@/stores/gameStore'
import { Hud } from '@/ui/hud/Hud'
import { MainMenu } from '@/ui/menus/MainMenu'
import { GameCanvas } from './GameCanvas'

export function GameRoot() {
  const phase = useGameStore((s) => s.phase)
  if (phase === 'menu') return <MainMenu />
  return (
    <div className="relative h-full w-full">
      <GameCanvas />
      <Hud />
    </div>
  )
}
