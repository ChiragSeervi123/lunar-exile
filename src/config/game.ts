export const PHYSICS = {
  /**
   * Lunar gravity, m/s², toward the Moon's centre. The physics world itself has none: "down"
   * differs everywhere on a sphere, so each moving thing pulls itself toward the centre.
   */
  lunarGravity: 1.62,
}

/** Rapier collision group indices (0-15). */
export const GROUP = { terrain: 0, obstacles: 1, player: 2, camera: 3, deposits: 4, interaction: 5 } as const

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
  /** Mineral deposits that stand up off the ground: the player and camera bump into them like rocks. */
  deposit: collisionGroups([GROUP.deposits], [GROUP.player, GROUP.camera, GROUP.interaction]),
  /** Deposits the player walks over (flat patches, mined-out sites with ore left to collect): aim only. */
  flatDeposit: collisionGroups([GROUP.deposits], [GROUP.interaction]),
  /** Player movement queries: the ground, obstacles and standing deposits. */
  playerQuery: collisionGroups([GROUP.player], [GROUP.terrain, GROUP.obstacles, GROUP.deposits]),
  /** Camera queries: the ground, obstacles and standing deposits, never the player's own body. */
  cameraQuery: collisionGroups([GROUP.camera], [GROUP.terrain, GROUP.obstacles, GROUP.deposits]),
  /** What the crosshair can pick: deposits only. */
  aimQuery: collisionGroups([GROUP.interaction], [GROUP.deposits]),
  /** Line of sight to a picked deposit: terrain and rocks block it. */
  sightQuery: collisionGroups([GROUP.interaction], [GROUP.terrain, GROUP.obstacles]),
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
  /** Aiming and mining, which need this frame's camera. */
  interaction: -25,
  /** Sky and shadow focus, which follow the camera and player. */
  followers: -20,
}

export const BUILD_LABEL = 'Milestone 4'

export const SAVE = {
  storageKey: 'lunar-exile-save',
  /** Bump when SaveData changes shape (and add a migration in save/saveGame.ts). */
  version: 5,
}

export const ECONOMY = {
  /** Fraction of an item's base value paid when selling to a trader. */
  sellMultiplier: 0.5,
}
