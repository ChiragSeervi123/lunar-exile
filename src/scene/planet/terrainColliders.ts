import type { RapierCollider, RapierContext } from '@react-three/rapier'
import { COLLISION } from '@/config/game'
import { PLANET_PHYSICS, PLANET_TERRAIN } from '@/config/planet'
import { nodeAt, nodeCenter, nodeKey, nodeReach, nodesWithin, type CubeNode, type Planet } from '@/game/planet'
import { clamp } from '@/utils/math'
import { dot, normalize, vec3, type Vec3 } from '@/utils/vec3'
import type { ChunkBuilder } from './chunkBuilder'
import { buildChunkMesh, type ChunkMesh, type ChunkMeshOptions } from './chunkMesh'

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

/** Collision tiles are bare terrain chunks: the same ground, without colours, normals or skirts. */
export const COLLISION_TILE_OPTIONS: ChunkMeshOptions = {
  resolution: PLANET_TERRAIN.chunkResolution,
  jitter: PLANET_TERRAIN.jitter,
  palette: null,
}

interface Tile {
  collider: RapierCollider
  center: Vec3
  /** Angle from the centre to the farthest corner, radians. */
  reach: number
}

interface Want {
  key: number
  node: CubeNode
  /** Lower bound on the distance from the player, meters. */
  distance: number
}

export interface TerrainColliders {
  /**
   * Keeps the tiles around `position` (world space) loaded: frees distant ones, sends the next
   * ones to the worker and builds any missing tile right under the player at once. Call before
   * every physics step; nearly free while the player stays within a few meters.
   */
  update(position: Vec3): void
  /**
   * Builds every missing tile within `radius` meters of `position` on this thread, now (a spawn or
   * a teleport). Rapier only sees new colliders after its next step.
   */
  ensure(position: Vec3, radius?: number): void
  /** Whether the tile under `position` has its collider. */
  covers(position: Vec3): boolean
  readonly count: number
  /** Tiles built so far (urgent ones on the main thread included), and tiles freed. */
  readonly stats: { built: number; urgent: number; freed: number }
  dispose(): void
}

/**
 * The ground under and around the player as Rapier triangle meshes, streamed as the player moves
 * so the whole Moon can be walked with only a handful of colliders alive. Tiles come from
 * `builder` (a worker) when given, else are built here, one per update.
 */
export function createTerrainColliders(world: World, rapier: Rapier, planet: Planet, builder: ChunkBuilder | null): TerrainColliders {
  const { tileDepth: depth, loadRadius, unloadRadius, urgentRadius, updateDistance } = PLANET_PHYSICS
  const R = planet.radius
  const tiles = new Map<number, Tile>()
  const stats = { built: 0, urgent: 0, freed: 0 }
  const dir = vec3()
  const probe: CubeNode = { face: 0, depth, ix: 0, iy: 0 }
  const last = vec3(Number.NaN, Number.NaN, Number.NaN)
  let wanted: Want[] = []
  let disposed = false

  const distanceTo = (tile: Tile, d: Vec3) => Math.max(0, Math.acos(clamp(dot(d, tile.center), -1, 1)) - tile.reach) * R

  const add = (mesh: ChunkMesh) => {
    if (tiles.has(mesh.key) || disposed) return
    const indices = mesh.indices instanceof Uint32Array ? mesh.indices : Uint32Array.from(mesh.indices)
    const desc = rapier.ColliderDesc.trimesh(mesh.positions, indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES)
      .setTranslation(mesh.center[0], mesh.center[1], mesh.center[2])
      .setCollisionGroups(COLLISION.terrain)
    const center = nodeCenter(mesh.node, vec3())
    tiles.set(mesh.key, { collider: world.createCollider(desc), center, reach: nodeReach(mesh.node, center) })
    stats.built++
  }
  const buildNow = (node: CubeNode) => add(buildChunkMesh(planet, node, COLLISION_TILE_OPTIONS))

  const refresh = () => {
    wanted = []
    nodesWithin(dir, loadRadius / R, depth, (node, distance) => {
      wanted.push({ key: nodeKey(node.face, depth, node.ix, node.iy), node: { ...node }, distance: distance * R })
    })
    wanted.sort((a, b) => a.distance - b.distance)
    for (const [key, tile] of tiles) {
      if (distanceTo(tile, dir) <= unloadRadius) continue
      // Removing takes effect at once, unlike adding.
      if (world.getCollider(tile.collider.handle) === tile.collider) world.removeCollider(tile.collider, false)
      tiles.delete(key)
      stats.freed++
    }
    if (builder) builder.wish(wanted.filter((w) => !tiles.has(w.key)).map((w) => ({ key: w.key, node: w.node, priority: w.distance })))
  }

  return {
    update(position) {
      if (disposed) return
      normalize(dir, position)
      if (builder) {
        for (const mesh of builder.take(2)) {
          // Only if still needed: the player may have moved on while it was being built.
          const center = nodeCenter(mesh.node, vec3())
          if ((Math.acos(clamp(dot(dir, center), -1, 1)) - nodeReach(mesh.node, center)) * R <= unloadRadius) add(mesh)
        }
      }
      const moved = Math.acos(clamp(dot(dir, last), -1, 1)) * R
      if (!(moved < updateDistance)) {
        last.x = dir.x
        last.y = dir.y
        last.z = dir.z
        refresh()
      }
      // The ground right around the player can't wait for the worker.
      for (const w of wanted) {
        if (w.distance >= urgentRadius) break
        if (tiles.has(w.key)) continue
        buildNow(w.node)
        stats.urgent++
      }
      if (!builder) {
        const next = wanted.find((w) => !tiles.has(w.key))
        if (next) buildNow(next.node)
      }
    },
    ensure(position, radius = loadRadius) {
      if (disposed) return
      normalize(dir, position)
      nodesWithin(dir, radius / R, depth, (node) => {
        if (!tiles.has(nodeKey(node.face, depth, node.ix, node.iy))) buildNow({ ...node })
      })
      last.x = dir.x
      last.y = dir.y
      last.z = dir.z
      refresh()
    },
    covers(position) {
      nodeAt(normalize(dir, position), depth, probe)
      return tiles.has(nodeKey(probe.face, depth, probe.ix, probe.iy))
    },
    get count() {
      return tiles.size
    },
    stats,
    dispose() {
      disposed = true
      builder?.dispose()
      for (const tile of tiles.values()) {
        // <Physics> may already have freed the world on unmount; only remove what is still ours.
        if (world.getCollider(tile.collider.handle) === tile.collider) world.removeCollider(tile.collider, false)
      }
      tiles.clear()
    },
  }
}
