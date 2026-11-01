import { PLAYER_BASE } from '@/data/player'

export interface SurvivalStats {
  health: number
  oxygen: number
  stamina: number
  shield: number
}

export type SurvivalMax = Record<keyof SurvivalStats, number>

export function baseSurvivalMax(): SurvivalMax {
  return {
    health: PLAYER_BASE.maxHealth,
    oxygen: PLAYER_BASE.maxOxygen,
    stamina: PLAYER_BASE.maxStamina,
    shield: PLAYER_BASE.maxShield,
  }
}

export function fullSurvivalStats(max: SurvivalMax): SurvivalStats {
  return { ...max }
}
