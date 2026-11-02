/** Moon terrain streaming. Detail per graphics quality is in config/graphics.ts. */
export const PLANET_TERRAIN = {
  /** Quads along each side of a terrain chunk. */
  chunkResolution: 32,
  /** Vertex jitter as a fraction of the grid spacing, to break up the visible grid (as on the flat map). */
  jitter: 0.2,
  /** Built chunks kept, including those off screen, so turning back is instant; the least recent go first. */
  cacheSize: 420,
  /** Chunk builds waiting in the workers at once. */
  maxInFlight: 8,
  /** Finished chunks turned into meshes per frame, to spread GPU uploads out. */
  uploadsPerFrame: 6,
  /** Background workers that build chunks, at most. */
  maxWorkers: 3,
}
