/** Live terrain numbers, for the loading cover and debugging. */
export const planetTerrainStatus = {
  /** The first view has its detail: safe to lift the loading cover. */
  ready: false,
  displayed: 0,
  cached: 0,
  /** Cached chunks that have been drawn, so hold GPU buffers (5 each: position, normal, colour, skirt, index). */
  drawn: 0,
  queued: 0,
  inFlight: 0,
  built: 0,
  /** Average build time of recent chunks, ms (in the workers). */
  buildMs: 0,
  triangles: 0,
  /** Average time from requesting a chunk to receiving it, ms. */
  latencyMs: 0,
  sent: 0,
  received: 0,
  duplicates: 0,
  /** Rocks drawn, and solid rocks with colliders around the player. */
  rocks: 0,
  rockColliders: 0,
  /** Ground collision tiles alive around the player. */
  collisionTiles: 0,
  /** Cave blocks built near the astronaut, and still to build. */
  caveBlocks: 0,
  caveQueued: 0,
}
