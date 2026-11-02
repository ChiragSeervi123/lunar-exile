import { getPlanet, type CubeNode } from '@/game/planet'
import { buildChunkMesh, type ChunkMesh, type ChunkMeshOptions } from './chunkMesh'

/** A chunk to build. */
export interface ChunkJob {
  id: number
  node: CubeNode
  options: ChunkMeshOptions
}

export interface ChunkResult {
  id: number
  mesh: ChunkMesh
}

// The worker holds its own copy of the Moon: generation is deterministic, so it matches the main thread's.
const planet = getPlanet()
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ChunkJob>) => void) | null
  postMessage(message: ChunkResult, transfer: Transferable[]): void
}

scope.onmessage = (event) => {
  const { id, node, options } = event.data
  const mesh = buildChunkMesh(planet, node, options)
  const transfer: Transferable[] = [mesh.positions.buffer, mesh.indices.buffer]
  if (mesh.normals) transfer.push(mesh.normals.buffer)
  if (mesh.colors) transfer.push(mesh.colors.buffer)
  scope.postMessage({ id, mesh }, transfer)
}
