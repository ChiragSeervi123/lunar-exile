import { usePlayerStore } from '@/stores/playerStore'
import { StatBar } from './StatBar'

export function SurvivalBars() {
  const survival = usePlayerStore((s) => s.survival)
  const max = usePlayerStore((s) => s.survivalMax)
  return (
    <div className="flex flex-col gap-1">
      <StatBar label="Health" value={survival.health} max={max.health} colorClass="bg-red-500" />
      <StatBar label="Shield" value={survival.shield} max={max.shield} colorClass="bg-cyan-400" />
      <StatBar label="Oxygen" value={survival.oxygen} max={max.oxygen} colorClass="bg-sky-300" />
      <StatBar label="Stamina" value={survival.stamina} max={max.stamina} colorClass="bg-amber-400" />
    </div>
  )
}
