import type { CubeNode, Planet } from '@/game/planet'
import { buildChunkMesh, type ChunkMesh, type ChunkMeshOptions } from './chunkMesh'
import type { ChunkJob, ChunkResult } from './chunkWorker'

export interface ChunkWish {
  key: number
  node: CubeNode
  /** Lower builds first. */
  priority: number
}

export interface ChunkBuilder {
  /**
   * Replaces the queue of chunks waiting to be built (most urgent first). Chunks already being
   * built finish regardless; anything no longer wished for is simply dropped.
   */
  wish(wishes: readonly ChunkWish[]): void
  /** Builds a chunk on this thread, right away (for the very first view, or a sudden jump). */
  buildNow(node: CubeNode): ChunkMesh
  /** Takes up to `max` finished chunks. */
  take(max: number): ChunkMesh[]
  /** Chunks queued or being built. */
  pending(key: number): boolean
  readonly inFlight: number
  readonly queued: number
  dispose(): void
}

/**
 * Builds chunks in a few Web Workers so the main thread keeps its frame rate while the Moon streams
 * in. Where workers aren't available, chunks are built on this thread a few per call instead.
 */
export function createChunkBuilder(planet: Planet, options: ChunkMeshOptions, workerCount: number, maxInFlight: number): ChunkBuilder {
  const workers: Worker[] = []
  if (typeof Worker !== 'undefined') {
    for (let i = 0; i < workerCount; i++) {
      workers.push(new Worker(new URL('./chunkWorker.ts', import.meta.url), { type: 'module', name: `moon-terrain-${i}` }))
    }
  }
  const busy = new Map<Worker, number>(workers.map((w) => [w, 0]))
  const inFlight = new Map<number, number>() // job id -> chunk key
  const inFlightKeys = new Set<number>()
  const done: ChunkMesh[] = []
  let queue: ChunkWish[] = []
  let queuedKeys = new Set<number>()
  let nextId = 1
  let disposed = false

  const onResult = (worker: Worker) => (event: MessageEvent<ChunkResult>) => {
    const { id, mesh } = event.data
    busy.set(worker, (busy.get(worker) ?? 1) - 1)
    inFlightKeys.delete(inFlight.get(id) ?? -1)
    inFlight.delete(id)
    if (!disposed) done.push(mesh)
    dispatch()
  }
  for (const w of workers) w.onmessage = onResult(w)

  const dispatch = () => {
    while (queue.length > 0 && inFlight.size < maxInFlight && workers.length > 0) {
      // The least busy worker.
      let target = workers[0]
      for (const w of workers) if (busy.get(w)! < busy.get(target)!) target = w
      const wish = queue.shift()!
      queuedKeys.delete(wish.key)
      if (inFlightKeys.has(wish.key)) continue
      const job: ChunkJob = { id: nextId++, node: wish.node, options }
      inFlight.set(job.id, wish.key)
      inFlightKeys.add(wish.key)
      busy.set(target, busy.get(target)! + 1)
      target.postMessage(job)
    }
  }

  return {
    wish(wishes) {
      queue = wishes.filter((w) => !inFlightKeys.has(w.key))
      queuedKeys = new Set(queue.map((w) => w.key))
      if (workers.length > 0) dispatch()
      else {
        // No workers: build the most urgent couple here.
        for (const w of queue.splice(0, 2)) done.push(buildChunkMesh(planet, w.node, options))
        queuedKeys = new Set(queue.map((w) => w.key))
      }
    },
    buildNow: (node) => buildChunkMesh(planet, node, options),
    take(max) {
      return done.splice(0, max)
    },
    pending: (key) => queuedKeys.has(key) || inFlightKeys.has(key),
    get inFlight() {
      return inFlight.size
    },
    get queued() {
      return queue.length
    },
    dispose() {
      disposed = true
      for (const w of workers) w.terminate()
      done.length = 0
      queue = []
    },
  }
}
