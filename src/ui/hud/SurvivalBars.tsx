import { HeartPulse, Shield, Wind, Zap } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { StatBar } from './StatBar'

export function SurvivalBars() {
  const survival = usePlayerStore((s) => s.survival)
  const max = usePlayerStore((s) => s.survivalMax)
  return (
    <div className="flex flex-col gap-2.5">
      <StatBar label="HEALTH" value={survival.health} max={max.health} icon={HeartPulse} color="var(--color-health)" />
      <StatBar label="SHIELD" value={survival.shield} max={max.shield} icon={Shield} color="var(--color-shield)" />
      <StatBar label="OXYGEN" value={survival.oxygen} max={max.oxygen} icon={Wind} color="var(--color-oxygen)" />
      <StatBar label="STAMINA" value={survival.stamina} max={max.stamina} icon={Zap} color="var(--color-stamina)" />
    </div>
  )
}
