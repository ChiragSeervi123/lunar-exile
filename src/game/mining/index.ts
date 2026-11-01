/** A resource node placed in the world (spawned from RegionDef.resourceNodes). */
export interface ResourceNode {
  id: string
  resourceId: string
  position: [number, number, number]
  /** Units left before the node is depleted. */
  remaining: number
}
