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

/**
 * Ground collision on the Moon, independent of graphics quality. Tiles are the terrain chunks of
 * one fixed depth (the high preset's finest), as triangle meshes, kept only around the player.
 */
export const PLANET_PHYSICS = {
  /**
   * Quadtree depth of a collision tile: depth 7 is about 43 m across, with 1.3 m between vertices,
   * which keeps the collision mesh within about 10 cm of the exact ground (99% of points) and
   * under 40 cm everywhere, so feet, rocks and deposits all agree on where the ground is.
   */
  tileDepth: 7,
  /** Tiles reaching within this distance of the player are kept loaded, meters. */
  loadRadius: 48,
  /** Tiles are freed once wholly beyond this distance, meters. */
  unloadRadius: 80,
  /** A missing tile this close is built at once on the main thread instead of waiting for the worker, meters. */
  urgentRadius: 12,
  /** Tile set is re-evaluated after the player moves this far, meters. */
  updateDistance: 4,
  /**
   * How far the feet may sit below the exact ground before being lifted back out, meters. Larger
   * than the worst gap between a collision tile and the exact ground it approximates.
   */
  sinkRecovery: 0.6,
  /** Feet this close above the exact ground count as grounded even if the controller missed it, meters. */
  groundProbe: 0.08,
  /** Physics steps a new or moved body is held still, so freshly built colliders are in the world first. */
  settleSteps: 2,
}

/** Rocks on the Moon, streamed in cells around the camera (drawing) and the player (collision). */
export const PLANET_ROCKS = {
  /** Rocks of each class are drawn this far from the camera, meters. */
  viewDistance: { debris: 90, medium: 400, boulder: 900 },
  /** Solid rocks get colliders within this distance of the player, and lose them beyond the second, meters. */
  colliderRadius: 40,
  colliderUnload: 64,
  /** The drawn cells are re-evaluated after the camera moves this far, meters. */
  updateDistance: 12,
  /** Time per frame spent generating new cells, ms (cells right around the player are never deferred). */
  budgetMs: 2,
  /** Generated cells kept for when the player comes back; the least recently used go first. */
  cacheCells: 3000,
}
