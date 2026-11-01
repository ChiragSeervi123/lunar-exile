export const CAMERA = {
  /** Vertical field of view per view mode, degrees. */
  fov: { menu: 50, 'third-person': 58, 'first-person': 72 },
  near: 0.25,
  /** Sky objects (stars, Earth, sun) are placed inside this distance. */
  far: 12000,
  /** Minimum clearance kept between the menu camera and the ground, meters. */
  groundClearance: 1.2,
  /** Radians of turn per pixel of mouse movement at sensitivity 1. */
  mouseRadiansPerPixel: 0.0022,

  /** Slow pan across the landing site behind the main menu. Angles in degrees, times in seconds. */
  menu: {
    distance: 110,
    height: 40,
    lookAhead: 240,
    lookHeight: 4,
    /** Turns the view left of Earth so Earth sits right of the menu text. */
    frameOffset: 15,
    sway: 8,
    period: 90,
  },

  /** Follow camera behind and above the astronaut. Distances in meters, angles in degrees. */
  thirdPerson: {
    distance: 4.6,
    /** Height of the point the camera orbits, above the feet. */
    pivotHeight: 1.55,
    /** Sideways offset for an over-the-shoulder view. */
    shoulderOffset: 0.45,
    pitchMin: -55,
    pitchMax: 35,
    /** Pitch when a game starts: looking slightly down past the astronaut. */
    startPitch: -10,
    /** Radius of the sphere swept from the pivot to keep the camera out of terrain and rocks. */
    collisionRadius: 0.25,
    collisionMargin: 0.1,
    /** Exponential smoothing rates (higher is tighter): following the body, and easing back out after an obstruction. */
    followSharpness: 22,
    verticalSharpness: 9,
    zoomOutSharpness: 4,
    /** Minimum clearance above the terrain, meters. */
    groundClearance: 0.3,
  },

  firstPerson: {
    /** Eye height above the feet, inside the helmet, meters. */
    eyeHeight: 1.66,
    pitchMin: -80,
    pitchMax: 80,
  },

  /** Closer than this to the astronaut's head, the body is hidden from the camera, meters. */
  hideBodyDistance: 0.75,

  /** Aspect ratio the horizontal framing offsets are tuned for; narrower screens scale them down. */
  referenceAspect: 16 / 9,
  /** Camera flight between the menu and the game, seconds. */
  transitionSeconds: 3.4,
  /** Extra height at the midpoint of that flight, meters. */
  transitionArc: 10,
  /** Blend between first and third person, seconds. */
  modeSwitchSeconds: 0.45,
}
