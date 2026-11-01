export const PHYSICS = {
  /** Lunar gravity, m/s^2. */
  gravity: [0, -1.62, 0] as [number, number, number],
  /** Grid spacing of the terrain collider, meters. Independent of graphics quality. */
  terrainColliderSpacing: 3,
}

/** Rapier collision group indices (0-15). */
export const GROUP = { terrain: 0, obstacles: 1, player: 2, camera: 3 } as const

const ALL_GROUPS = Array.from({ length: 16 }, (_, i) => i)

/** Packs Rapier interaction groups: the groups a collider belongs to, and the groups it interacts with. */
export function collisionGroups(memberships: readonly number[], filters: readonly number[]): number {
  const mask = (groups: readonly number[]) => groups.reduce((bits, group) => bits | (1 << group), 0)
  return ((mask(memberships) << 16) | mask(filters)) >>> 0
}

export const COLLISION = {
  terrain: collisionGroups([GROUP.terrain], ALL_GROUPS),
  obstacles: collisionGroups([GROUP.obstacles], ALL_GROUPS),
  player: collisionGroups([GROUP.player], ALL_GROUPS),
  /** Player movement queries: the ground and obstacles. */
  playerQuery: collisionGroups([GROUP.player], [GROUP.terrain, GROUP.obstacles]),
  /** Camera queries: the ground and obstacles, never the player's own body. */
  cameraQuery: collisionGroups([GROUP.camera], [GROUP.terrain, GROUP.obstacles]),
}

/**
 * useFrame order (lower runs first). Kept at or below 0: positive priorities switch off R3F's
 * automatic rendering.
 */
export const FRAME_PRIORITY = {
  /** Physics step and rigid-body interpolation. */
  physics: -50,
  /** Player render position and animation, from the fresh physics state. */
  player: -40,
  camera: -30,
  /** Sky and shadow focus, which follow the camera and player. */
  followers: -20,
}

export const BUILD_LABEL = 'Milestone 2'

export const SAVE = {
  storageKey: 'lunar-exile-save',
  /** Bump when SaveData changes shape (and add a migration in save/saveGame.ts). */
  version: 2,
}

export const ECONOMY = {
  /** Fraction of an item's base value paid when selling to a trader. */
  sellMultiplier: 0.5,
}
