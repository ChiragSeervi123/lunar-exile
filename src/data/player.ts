/** Base player stats before upgrades. */
export const PLAYER_BASE = {
  maxHealth: 100,
  maxOxygen: 100,
  maxStamina: 100,
  maxShield: 100,
  /** Ground speeds, m/s. */
  walkSpeed: 4,
  sprintSpeed: 7,
  /** Upward speed at takeoff, m/s. */
  jumpSpeed: 3.3,
} as const

export const STARTING_CREDITS = 0
export const STARTING_REGION = 'landing-site' as const
export const STARTING_TOOL = 'basic-mining-tool' as const
