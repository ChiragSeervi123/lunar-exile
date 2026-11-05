/** The Scout Lander, where the astronaut came down: its trade terminal buys resources and sells gear. */
export const LANDER = {
  /**
   * Where it stands on the landing-site map (x east, z south), meters: a few steps behind the
   * arrival point (which faces north, toward Earth), on the levelled ground and clear of deposits.
   */
  x: -6,
  z: 13,
  /** The terminal, in the lander's own frame (x right, y up, z back; it faces the arrival point). */
  terminal: [0, 1.25, -3.1] as const,
  /** How close the astronaut's chest must be to the terminal's screen to use it, meters. */
  reach: 2.8,
  /** Beyond this distance the HUD points the way back to the lander, meters. */
  guideBeyond: 40,
}

/** Selling everything at once asks first when it is worth at least this much, LC. */
export const CONFIRM_SALE_OVER = 100
