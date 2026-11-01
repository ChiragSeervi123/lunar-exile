import type { MoonDef } from '@/types/content'

/**
 * The playable Moon: a sphere small enough to walk around (a lap is about 22 km) yet large enough
 * that the curved horizon reads as a world, not an asteroid. The landing site region sits at the
 * +Y pole, where the planet's axes match the flat landing-site map.
 */
export const MOON: MoonDef = {
  name: 'The Moon',
  radius: 3500,
  seed: 1969,
  landingRegion: 'landing-site',
  provinces: 42,
}
