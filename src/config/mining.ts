/** Mining interaction and deposit placement tuning. Tool power and reach are in data/tools.ts. */
export const MINING = {
  /** Deposits past the tool's reach still show their name this far from the astronaut, meters. */
  scanRange: 16,
  /**
   * In third person the aim ray starts this far behind the astronaut, not at the camera, so nothing
   * between the camera and the body can be picked, meters.
   */
  aimStartBehind: 0.6,
  /**
   * Terrain or rock hit this little in front of a deposit doesn't block it, meters. Covers the gap
   * between the coarse terrain collider and the drawn ground the deposit sits on.
   */
  sightTolerance: 0.35,
  /** Height on the astronaut that reach is measured from, meters above the feet. */
  reachHeight: 1.25,
  /** Landing zone kept free of deposits, meters from the spawn point. */
  clearRadius: 22,
  /** Minimum gap between deposits, meters. */
  minSpacing: 7,
  /** Steepest ground a deposit forms on, degrees. */
  maxSlope: 28,
  /** How often depleted deposits are checked for regrowth, seconds. */
  respawnCheckInterval: 1,
  /** A deposit doesn't regrow while the astronaut stands this close to its edge, meters. */
  respawnClearance: 1.5,
  notifications: {
    /** How long a "+N item" notice stays, ms. */
    duration: 3400,
    /** Most notices on screen at once. */
    max: 4,
    /** Repeat pickups of the same item within this window add to the existing notice, ms. */
    mergeWindow: 2500,
  },
  /**
   * Digging cave walls like dirt: each bite removes a ball of rock this big (meters) and gives this
   * item. A bite takes `bitePower / tool power` seconds. Rock this close under the surface (meters)
   * can't be dug, so nobody tunnels up into the open from below.
   */
  dig: { radius: 0.9, bitePower: 14, itemId: 'lunar-dust', perBite: 1, minDepth: 2.2 },
  /** Camera shake strength while mining and when a deposit breaks; decay per second. */
  shake: { mining: 0.35, burst: 0.55, decay: 2.4 },
}
