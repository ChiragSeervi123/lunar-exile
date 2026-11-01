export interface DamageEvent {
  /** Entity id of the target. */
  targetId: string
  amount: number
  sourceId?: string
  weaponId?: string
}
