export interface MissionProgress {
  missionId: string
  /** Progress per objective, same order as MissionDef.objectives. */
  objectives: number[]
  completed: boolean
}
