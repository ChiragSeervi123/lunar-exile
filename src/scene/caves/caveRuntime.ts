import type { CaveStreamer } from './caveStreamer'

/** The live cave streamer, for systems that need to know what a collider is (digging). */
export const caveRuntime = { streamer: null as CaveStreamer | null }
