/** Live terrain numbers, for the loading cover and debugging. */
export const planetTerrainStatus = {
  /** The first view has its detail: safe to lift the loading cover. */
  ready: false,
  displayed: 0,
  cached: 0,
  queued: 0,
  inFlight: 0,
  built: 0,
  /** Average build time of recent chunks, ms (in the workers). */
  buildMs: 0,
  triangles: 0,
}
