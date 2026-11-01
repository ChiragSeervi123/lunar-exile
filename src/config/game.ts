export const PHYSICS = {
  /** Lunar gravity, m/s^2. */
  gravity: [0, -1.62, 0] as [number, number, number],
}

export const SAVE = {
  storageKey: 'lunar-exile-save',
  /** Bump when SaveData changes shape. */
  version: 1,
}

export const ECONOMY = {
  /** Fraction of an item's base value paid when selling to a trader. */
  sellMultiplier: 0.5,
}
