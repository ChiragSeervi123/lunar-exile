export const CAMERA = {
  fov: { 'first-person': 75, 'third-person': 60 },
  /** Field of view for menu and intro shots. */
  cinematicFov: 50,
  near: 0.25,
  /** Sky objects (stars, Earth, sun) are placed inside this distance. */
  far: 12000,
  /** Eye height above the player's feet in first person, meters. */
  eyeHeight: 1.7,
  /** Offset from the player in third person: [right, up, back]. */
  thirdPersonOffset: [0.6, 2, 4.5] as [number, number, number],
  /** Minimum clearance kept between the camera and the ground, meters. */
  groundClearance: 1.2,

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
  /** Over-the-shoulder establishing shot of the landing zone, where the astronaut will stand. */
  intro: {
    distance: 9,
    height: 3.6,
    /** Camera position around the spawn point, relative to the view toward Earth. */
    angle: -18,
    lookAhead: 24,
    lookHeight: 1.6,
    frameOffset: 13,
    drift: 0.3,
  },
  /** Aspect ratio the horizontal framing offsets are tuned for; narrower screens scale them down. */
  referenceAspect: 16 / 9,
  transitionSeconds: 3.4,
  /** Extra height at the midpoint of a camera transition, meters. */
  transitionArc: 10,
}
