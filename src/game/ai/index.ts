export type AiState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee'

/** Runtime state of one spawned enemy (static stats live in EnemyDef). */
export interface EnemyInstance {
  id: string
  enemyId: string
  health: number
  state: AiState
  position: [number, number, number]
}
