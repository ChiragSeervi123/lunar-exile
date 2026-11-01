export type GraphicsQuality = 'low' | 'medium' | 'high'

export interface GraphicsPreset {
  label: string
  description: string
  /** Device-pixel-ratio range handed to the renderer. */
  dpr: [number, number]
  shadowMapSize: number
  /** Half-width of the sun-shadowed area behind the main menu, meters. */
  shadowExtent: number
  /** Half-width of the sun-shadowed area that travels with the player, meters. Smaller is sharper. */
  followShadowExtent: number
  /** Terrain vertex spacing inside the playable area, meters. */
  terrainSpacing: number
  /** Segments per side of each ring of the horizon terrain beyond the playable area. */
  horizonSegments: number
  /** Multiplier on the region's small-debris density (decorative only). */
  debrisDensity: number
  starCount: number
}

export const GRAPHICS_QUALITIES: GraphicsQuality[] = ['low', 'medium', 'high']

export const GRAPHICS_PRESETS: Record<GraphicsQuality, GraphicsPreset> = {
  low: {
    label: 'Low',
    description: 'For integrated graphics and older hardware.',
    dpr: [1, 1],
    shadowMapSize: 1024,
    shadowExtent: 170,
    followShadowExtent: 75,
    terrainSpacing: 4,
    horizonSegments: 48,
    debrisDensity: 0.3,
    starCount: 3000,
  },
  medium: {
    label: 'Medium',
    description: 'Balanced detail for most desktop graphics cards.',
    dpr: [1, 1.5],
    shadowMapSize: 2048,
    shadowExtent: 230,
    followShadowExtent: 100,
    terrainSpacing: 3,
    horizonSegments: 80,
    debrisDensity: 0.6,
    starCount: 6000,
  },
  high: {
    label: 'High',
    description: 'Full detail for dedicated graphics cards.',
    dpr: [1, 2],
    shadowMapSize: 4096,
    shadowExtent: 290,
    followShadowExtent: 140,
    terrainSpacing: 2,
    horizonSegments: 128,
    debrisDensity: 1,
    starCount: 10000,
  },
}

export const DEFAULT_GRAPHICS_QUALITY: GraphicsQuality = 'medium'

/** Extra render layers. Layer 0 is the default. */
export const RENDER_LAYERS = {
  /** Drawn into shadow maps but not by the main camera, e.g. the player's body in first person. */
  shadowOnly: 1,
}
