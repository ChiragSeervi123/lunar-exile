import type { RegionDef } from '@/types/content'

export const REGIONS = {
  'landing-site': {
    name: 'Landing Site',
    description: 'Where your lander came down, on the floor of an ancient impact basin.',
    coordinates: '0.67°N 23.47°E',
    size: 600,
    spawn: { x: 0, z: 0 },
    terrain: {
      seed: 1969,
      extent: 3200,
      relief: 9,
      roughness: 0.45,
      craterTiers: [
        { count: 7, minRadius: 45, maxRadius: 115, spread: 2300 },
        { count: 85, minRadius: 12, maxRadius: 40, spread: 1400 },
        { count: 320, minRadius: 2.5, maxRadius: 11, spread: 460 },
      ],
      landmarks: [
        // Toward Earth from the landing zone, so Earth rises above its rim.
        { x: 30, z: -175, radius: 80, freshness: 0.85 },
        // A young rayed crater beside the landing zone.
        { x: 72, z: -34, radius: 21, freshness: 1 },
        { x: -150, z: -60, radius: 30, freshness: 0.45 },
        { x: 175, z: 70, radius: 38, freshness: 0.35 },
        { x: -60, z: 190, radius: 52, freshness: 0.55 },
      ],
      horizon: { radius: 1150, height: 240 },
    },
    rocks: { debrisDensity: 1.6, mediumDensity: 0.2, boulderDensity: 0.012, rimBoulders: 1.2 },
    sky: {
      sun: { azimuth: 105, elevation: 15 },
      earth: { azimuth: 8, elevation: 13, angularSize: 6.5 },
      fog: { color: '#0b1020', near: 900, far: 7500 },
    },
    palette: {
      highlands: '#aaa9a4',
      maria: '#71737a',
      craterFloor: '#5d5f65',
      ejecta: '#d6d4cc',
      rock: '#8e8c88',
    },
    // Deposits per hectare: about 40 dust patches down to two ancient structures across the site.
    resourceNodes: [
      { resourceId: 'lunar-dust', density: 1.1 },
      { resourceId: 'regolith-deposit', density: 0.9 },
      { resourceId: 'titanium-vein', density: 0.45 },
      { resourceId: 'helium3-vein', density: 0.22 },
      { resourceId: 'alien-crystal', density: 0.1 },
      { resourceId: 'ancient-relic', density: 0.05 },
    ],
    enemySpawns: [],
  },
} satisfies Record<string, RegionDef>

export type RegionId = keyof typeof REGIONS

export function getRegion(id: string): RegionDef {
  const region = (REGIONS as Record<string, RegionDef>)[id]
  if (!region) throw new Error(`Unknown region: ${id}`)
  return region
}
