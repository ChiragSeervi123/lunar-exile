import type { RapierCollider, RapierContext } from '@react-three/rapier'
import { BufferAttribute, BufferGeometry, Mesh, Sphere, Vector3, type Group, type Material } from 'three'
import { COLLISION } from '@/config/game'
import { toCaveLocal, type Cave, type CaveQueries, type CaveShape, type Planet } from '@/game/planet'
import type { ChunkPalette } from '@/scene/planet/chunkMesh'
import { vec3, type Vec3 } from '@/utils/vec3'
import { BLOCK, buildCaveBlock, caveBlocks, createCaveGround, type CaveBlockMesh, type CaveGround } from './caveMesh'

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

/** Caves within this distance of the astronaut (or camera) are built, meters; beyond the second, freed. */
const LOAD = 160
const UNLOAD = 260
/** Time per frame spent building blocks, ms. */
const BUDGET = 4

interface Built {
  mesh: Mesh | null
  collider: RapierCollider | null
}

interface Loaded {
  cave: Cave
  shape: CaveShape
  ground: CaveGround
  /** Blocks still to build, nearest the astronaut first. */
  queue: { bx: number; by: number; bz: number }[]
  built: Map<string, Built>
}

export interface CaveStreamer {
  /** Call every frame with where the astronaut (or, without one, the camera) is. */
  update(center: Vec3): void
  /** The cave a collider belongs to, if it is a cave wall. */
  caveOf(collider: RapierCollider): Cave | undefined
  /** Rebuilds the blocks a dig (local sphere) touched, at once. */
  dug(caveId: string, x: number, y: number, z: number, r: number): void
  /** Blocks of loaded caves built so far, and still to build. */
  readonly stats: { caves: number; blocks: number; queued: number; triangles: number }
  dispose(): void
}

/**
 * Caves near the astronaut, a block at a time: meshes to see and colliders to walk on, built
 * nearest first within a small budget per frame (long before anyone can reach them), and dropped
 * again once far away. Digging rebuilds just the blocks it touched.
 */
export function createCaveStreamer(options: {
  planet: Planet
  queries: CaveQueries
  /** Each cave's digs ([x, y, z, radius] in its frame). */
  digsOf: (caveId: string) => readonly number[]
  group: Group | null
  material: Material | null
  physics: { world: World; rapier: Rapier } | null
  /** The terrain's colours, so rock right under the ground matches it; null leaves it rock-coloured. */
  palette?: ChunkPalette | null
}): CaveStreamer {
  const { planet, queries, digsOf, group, material, physics } = options
  const palette = options.palette ?? null
  const loaded = new Map<string, Loaded>()
  const byCollider = new Map<number, Cave>()
  const stats = { caves: 0, blocks: 0, queued: 0, triangles: 0 }
  const local = vec3()
  const key = (bx: number, by: number, bz: number) => `${bx}:${by}:${bz}`

  const add = (l: Loaded, block: CaveBlockMesh | null, k: string) => {
    const built: Built = { mesh: null, collider: null }
    if (block) {
      if (group && material) {
        const geometry = new BufferGeometry()
        geometry.setAttribute('position', new BufferAttribute(block.positions, 3))
        geometry.setAttribute('color', new BufferAttribute(block.colors, 3))
        geometry.setAttribute('sky', new BufferAttribute(block.sky, 1))
        geometry.setIndex(new BufferAttribute(block.indices, 1))
        geometry.boundingSphere = new Sphere(new Vector3(), BLOCK * 1.2)
        const mesh = new Mesh(geometry, material)
        mesh.position.set(...block.center)
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
        built.mesh = mesh
      }
      if (physics) {
        const desc = physics.rapier.ColliderDesc.trimesh(block.positions, block.indices)
          .setTranslation(...block.center)
          .setCollisionGroups(COLLISION.terrain)
        built.collider = physics.world.createCollider(desc)
        byCollider.set(built.collider.handle, l.cave)
      }
      stats.triangles += block.indices.length / 3
    }
    l.built.set(k, built)
  }

  const remove = (built: Built) => {
    if (built.mesh) {
      group?.remove(built.mesh)
      built.mesh.geometry.dispose()
      stats.triangles -= (built.mesh.geometry.index?.count ?? 0) / 3
    }
    if (built.collider && physics) {
      byCollider.delete(built.collider.handle)
      // <Physics> may already have freed the world on unmount; only remove what is still ours.
      if (physics.world.getCollider(built.collider.handle) === built.collider) physics.world.removeCollider(built.collider, false)
    }
  }

  const sortQueue = (l: Loaded, center: Vec3) => {
    toCaveLocal(l.cave, center, local)
    const d = (b: { bx: number; by: number; bz: number }) =>
      Math.hypot((b.bx + 0.5) * BLOCK - local.x, (b.by + 0.5) * BLOCK - local.y, (b.bz + 0.5) * BLOCK - local.z)
    l.queue.sort((a, b) => d(a) - d(b))
  }

  return {
    stats,
    update(center) {
      const r = Math.hypot(center.x, center.y, center.z)
      for (const cave of queries.near(center, LOAD)) {
        if (loaded.has(cave.id)) continue
        const l: Loaded = { cave, shape: queries.shape(cave), ground: createCaveGround(planet, cave, palette), queue: caveBlocks(cave), built: new Map() }
        sortQueue(l, center)
        loaded.set(cave.id, l)
      }
      for (const [id, l] of loaded) {
        const along = Math.acos(Math.min(1, (l.cave.dir.x * center.x + l.cave.dir.y * center.y + l.cave.dir.z * center.z) / r)) * planet.radius
        if (along < UNLOAD) continue
        for (const built of l.built.values()) remove(built)
        loaded.delete(id)
      }
      const started = performance.now()
      for (const l of loaded.values()) {
        while (l.queue.length > 0 && performance.now() - started < BUDGET) {
          const b = l.queue.shift()!
          const k = key(b.bx, b.by, b.bz)
          // A block queued again after a dig keeps its old rock until the new is ready.
          const old = l.built.get(k)
          if (old) remove(old)
          add(l, buildCaveBlock(l.cave, l.shape, l.ground, digsOf(l.cave.id), b.bx, b.by, b.bz), k)
        }
      }
      stats.caves = loaded.size
      stats.queued = [...loaded.values()].reduce((n, l) => n + l.queue.length, 0)
      stats.blocks = [...loaded.values()].reduce((n, l) => n + l.built.size, 0)
    },
    caveOf: (collider) => byCollider.get(collider.handle),
    dug(caveId, x, y, z, radius) {
      const l = loaded.get(caveId)
      if (!l) return
      // The block the bite is in is rebuilt at once, so the hole shows (and can be walked into)
      // this frame. Neighbours it reaches into (a bite near a block's edge) go to the front of the
      // queue and follow within the streaming budget, instead of all in this one frame.
      const home = key(Math.floor(x / BLOCK), Math.floor(y / BLOCK), Math.floor(z / BLOCK))
      const later: { bx: number; by: number; bz: number }[] = []
      for (let bx = Math.floor((x - radius - 1) / BLOCK); bx <= Math.floor((x + radius + 1) / BLOCK); bx++) {
        for (let by = Math.floor((y - radius - 1) / BLOCK); by <= Math.floor((y + radius + 1) / BLOCK); by++) {
          for (let bz = Math.floor((z - radius - 1) / BLOCK); bz <= Math.floor((z + radius + 1) / BLOCK); bz++) {
            const k = key(bx, by, bz)
            l.queue = l.queue.filter((b) => key(b.bx, b.by, b.bz) !== k)
            if (k !== home) {
              later.push({ bx, by, bz })
              continue
            }
            const old = l.built.get(k)
            if (old) remove(old)
            add(l, buildCaveBlock(l.cave, l.shape, l.ground, digsOf(caveId), bx, by, bz), k)
          }
        }
      }
      l.queue.unshift(...later)
    },
    dispose() {
      for (const l of loaded.values()) for (const built of l.built.values()) remove(built)
      loaded.clear()
    },
  }
}
