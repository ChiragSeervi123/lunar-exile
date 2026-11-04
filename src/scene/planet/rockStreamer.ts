import type { RapierContext, RapierRigidBody } from '@react-three/rapier'
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3, type Box3, type BufferGeometry, type Group, type Material } from 'three'
import { COLLISION } from '@/config/game'
import { PLANET_ROCKS } from '@/config/planet'
import {
  nodeAt,
  nodeCenter,
  nodeKey,
  nodeReach,
  nodesWithin,
  ROCK_CELL_DEPTH,
  type CubeNode,
  type Planet,
  type PlanetRock,
  type PlanetRockField,
} from '@/game/planet'
import { ROCK_CLASSES, ROCK_VARIANTS, type RockClass } from '@/game/world'
import { clamp } from '@/utils/math'
import { dot, length, normalize, vec3, type Vec3 } from '@/utils/vec3'
import { fitRockCollider, rockShapeBounds, SOLID_ROCK_CLASSES } from '../world/rockColliderShapes'

type World = RapierContext['world']
type Rapier = RapierContext['rapier']

/** Debris shadows would be sub-pixel; skipping them keeps the shadow pass cheap. */
const CASTS_SHADOW: Record<RockClass, boolean> = { debris: false, medium: true, boulder: true }

export interface RockStreamerOptions {
  planet: Planet
  field: PlanetRockField
  /** Graphics quality's share of decorative debris. */
  debrisDensity: number
  /** Shapes per class and variant (shared by drawing and collision). */
  geometries: Record<RockClass, BufferGeometry[]>
  material: Material
  tint: Color
  /** Where the instanced meshes go; null for collision only. */
  group: Group | null
  /** Physics world for the solid rocks around the player; null for drawing only. */
  physics: { world: World; rapier: Rapier } | null
}

export interface RockStreamerStats {
  /** Cells generated so far, and how long generation took in total, ms. */
  generated: number
  generateMs: number
  /** Rocks drawn per class. */
  drawn: Record<RockClass, number>
  /** Solid rocks with colliders, in how many cells. */
  colliders: number
  colliderCells: number
}

export interface RockStreamer {
  /**
   * Call every frame: `view` is the camera (which rocks are drawn), `player` the body's feet (which
   * rocks are solid), or null without a body.
   */
  update(view: Vec3, player: Vec3 | null): void
  /** Generates and returns the rocks of one class in the cell containing `dir` (tests, placement). */
  rocksAt(dir: Vec3, cls: RockClass): readonly PlanetRock[]
  readonly stats: RockStreamerStats
  dispose(): void
}

interface Want {
  key: number
  node: CubeNode
  distance: number
}

interface ColliderCell {
  body: RapierRigidBody
  center: Vec3
  reach: number
  count: number
}

/**
 * Rocks over the whole Moon, a cell at a time: cells near the camera are generated (a few per
 * frame, nearest first), drawn with one instanced mesh per class and shape, and dropped again
 * when far away; the solid rocks of the cells right around the player get colliders. The landing
 * site's rocks are sorted into the same cells, so one system covers everything.
 */
export function createRockStreamer(options: RockStreamerOptions): RockStreamer {
  const { planet, field, debrisDensity, geometries, material, tint, group, physics } = options
  const { viewDistance, colliderRadius, colliderUnload, updateDistance, budgetMs, cacheCells } = PLANET_ROCKS
  const R = planet.radius
  const depth = ROCK_CELL_DEPTH
  const classIndex: Record<RockClass, number> = { debris: 0, medium: 1, boulder: 2 }
  const cellKey = (key: number, cls: RockClass) => key * 4 + classIndex[cls]
  const stats: RockStreamerStats = { generated: 0, generateMs: 0, drawn: { debris: 0, medium: 0, boulder: 0 }, colliders: 0, colliderCells: 0 }
  const node: CubeNode = { face: 0, depth, ix: 0, iy: 0 }
  const dir = vec3()

  // The landing site's rocks, sorted into cells.
  const landing = new Map<number, PlanetRock[]>()
  const landingRocks = field.landing(debrisDensity)
  for (const cls of ROCK_CLASSES) {
    for (const rock of landingRocks[cls]) {
      nodeAt(normalize(dir, vec3(rock.x, rock.y, rock.z)), depth, node)
      const k = cellKey(nodeKey(node.face, depth, node.ix, node.iy), cls)
      let list = landing.get(k)
      if (!list) landing.set(k, (list = []))
      list.push(rock)
    }
  }

  // Generated cells, least recently used first.
  const cache = new Map<number, PlanetRock[]>()
  const generate = (n: CubeNode, key: number, cls: RockClass): PlanetRock[] => {
    const k = cellKey(key, cls)
    const cached = cache.get(k)
    if (cached) {
      cache.delete(k)
      cache.set(k, cached)
      return cached
    }
    const started = performance.now()
    const rocks = field.cell(n, cls, debrisDensity)
    const own = landing.get(k)
    if (own) rocks.push(...own)
    stats.generated++
    stats.generateMs += performance.now() - started
    if (cache.size >= cacheCells) cache.delete(cache.keys().next().value!)
    cache.set(k, rocks)
    return rocks
  }

  // ---------------------------------------------------------------- drawing
  const bounds = rockShapeBounds(geometries)
  const meshes = ROCK_CLASSES.map((cls) => geometries[cls].map(() => null as InstancedMesh | null))
  const wanted: Want[][] = ROCK_CLASSES.map(() => [])
  /** Every wanted cell of every class, nearest first: the generation queue. */
  let pending: { c: number; want: Want }[] = []
  const shown: Set<number>[] = ROCK_CLASSES.map(() => new Set())
  const dirty = ROCK_CLASSES.map(() => false)
  const lastView = vec3(Number.NaN, Number.NaN, Number.NaN)
  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Quaternion()
  const scale = new Vector3()
  const color = new Color()

  const meshFor = (c: number, variant: number, count: number): InstancedMesh => {
    let mesh = meshes[c][variant]
    if (mesh && mesh.instanceMatrix.count >= count) return mesh
    const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(count, 1) * 1.25)))
    if (mesh) {
      group!.remove(mesh)
      mesh.dispose()
    }
    mesh = new InstancedMesh(geometries[ROCK_CLASSES[c]][variant], material, capacity)
    mesh.castShadow = CASTS_SHADOW[ROCK_CLASSES[c]]
    mesh.receiveShadow = true
    mesh.count = 0
    group!.add(mesh)
    meshes[c][variant] = mesh
    return mesh
  }

  const rebuild = (c: number) => {
    const cls = ROCK_CLASSES[c]
    const byVariant: PlanetRock[][] = Array.from({ length: ROCK_VARIANTS }, () => [])
    shown[c].clear()
    for (const w of wanted[c]) {
      const rocks = cache.get(cellKey(w.key, cls))
      if (!rocks) continue
      shown[c].add(w.key)
      for (const rock of rocks) byVariant[rock.variant].push(rock)
    }
    let drawn = 0
    byVariant.forEach((rocks, variant) => {
      if (rocks.length === 0 && !meshes[c][variant]) return
      const mesh = meshFor(c, variant, rocks.length)
      rocks.forEach((rock, i) => {
        position.set(rock.x, rock.y, rock.z)
        rotation.set(rock.qx, rock.qy, rock.qz, rock.qw)
        mesh.setMatrixAt(i, matrix.compose(position, rotation, scale.set(rock.sx, rock.sy, rock.sz)))
        mesh.setColorAt(i, color.copy(tint).multiplyScalar(rock.shade))
      })
      mesh.count = rocks.length
      mesh.visible = rocks.length > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      if (rocks.length > 0) mesh.computeBoundingSphere()
      drawn += rocks.length
    })
    stats.drawn[cls] = drawn
    dirty[c] = false
  }

  const refreshView = (view: Vec3) => {
    normalize(dir, view)
    // From high up, only what is within reach in 3D counts.
    const altitude = Math.max(0, length(view) - planet.surfaceRadius(dir))
    const reach = ROCK_CLASSES.map((cls) => Math.sqrt(Math.max(0, viewDistance[cls] ** 2 - altitude ** 2)))
    const widest = Math.max(...reach)
    const next: Want[][] = ROCK_CLASSES.map(() => [])
    if (widest > 0) {
      nodesWithin(dir, widest / R, depth, (n, distance) => {
        const meters = distance * R
        const want = { key: nodeKey(n.face, depth, n.ix, n.iy), node: { ...n }, distance: meters }
        ROCK_CLASSES.forEach((_, c) => {
          if (meters <= reach[c]) next[c].push(want)
        })
      })
    }
    pending = []
    next.forEach((list, c) => {
      // Redraw if the set of cells changed.
      if (list.length !== shown[c].size || list.some((w) => !shown[c].has(w.key))) dirty[c] = true
      wanted[c] = list
      for (const want of list) if (!cache.has(cellKey(want.key, ROCK_CLASSES[c]))) pending.push({ c, want })
    })
    pending.sort((a, b) => a.want.distance - b.want.distance)
  }

  // ---------------------------------------------------------------- collision
  const colliderCells = new Map<number, ColliderCell>()
  const lastPlayer = vec3(Number.NaN, Number.NaN, Number.NaN)
  const playerDir = vec3()
  const colliderRotation = new Quaternion()

  const addColliders = (n: CubeNode, key: number) => {
    if (!physics || colliderCells.has(key)) return
    const { world, rapier } = physics
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed())
    let count = 0
    for (const cls of SOLID_ROCK_CLASSES) {
      const box: Box3[] = bounds[cls]
      for (const rock of generate(n, key, cls)) {
        colliderRotation.set(rock.qx, rock.qy, rock.qz, rock.qw)
        const shape = fitRockCollider(box[rock.variant], rock.x, rock.y, rock.z, colliderRotation, rock.sx, rock.sy, rock.sz)
        const [hx, hy, hz] = shape.halfExtents
        const [tx, ty, tz] = shape.translation
        const [qx, qy, qz, qw] = shape.rotation
        world.createCollider(
          rapier.ColliderDesc.roundCuboid(hx, hy, hz, shape.borderRadius)
            .setTranslation(tx, ty, tz)
            .setRotation({ x: qx, y: qy, z: qz, w: qw })
            .setCollisionGroups(COLLISION.obstacles),
          body,
        )
        count++
      }
    }
    const center = nodeCenter(n, vec3())
    colliderCells.set(key, { body, center, reach: nodeReach(n, center), count })
    stats.colliders += count
    stats.colliderCells = colliderCells.size
  }

  const removeBody = (body: RapierRigidBody) => {
    if (!physics) return
    // <Physics> may already have freed the world on unmount; only remove what is still ours.
    if (physics.world.getRigidBody(body.handle) === body) physics.world.removeRigidBody(body)
  }

  const refreshColliders = (player: Vec3) => {
    normalize(playerDir, player)
    if (Math.acos(clamp(dot(playerDir, lastPlayer), -1, 1)) * R < 3) return
    lastPlayer.x = playerDir.x
    lastPlayer.y = playerDir.y
    lastPlayer.z = playerDir.z
    for (const [key, cell] of colliderCells) {
      if ((Math.acos(clamp(dot(playerDir, cell.center), -1, 1)) - cell.reach) * R <= colliderUnload) continue
      removeBody(cell.body)
      stats.colliders -= cell.count
      colliderCells.delete(key)
    }
    nodesWithin(playerDir, colliderRadius / R, depth, (n) => addColliders({ ...n }, nodeKey(n.face, depth, n.ix, n.iy)))
    stats.colliderCells = colliderCells.size
  }

  return {
    update(view, player) {
      if (player) refreshColliders(player)
      if (!group) return
      if (!(Math.hypot(view.x - lastView.x, view.y - lastView.y, view.z - lastView.z) < updateDistance)) {
        lastView.x = view.x
        lastView.y = view.y
        lastView.z = view.z
        refreshView(view)
      }
      // Generate missing cells, nearest first, within the frame budget.
      const started = performance.now()
      let done = 0
      while (done < pending.length && performance.now() - started < budgetMs) {
        const { c, want } = pending[done++]
        const cls = ROCK_CLASSES[c]
        // Cells generated meanwhile (for collision) only need drawing.
        if (!cache.has(cellKey(want.key, cls))) generate(want.node, want.key, cls)
        dirty[c] = true
      }
      if (done > 0) pending = pending.slice(done)
      for (let c = 0; c < ROCK_CLASSES.length; c++) if (dirty[c]) rebuild(c)
    },
    rocksAt(d, cls) {
      nodeAt(d, depth, node)
      return generate({ ...node }, nodeKey(node.face, depth, node.ix, node.iy), cls)
    },
    stats,
    dispose() {
      for (const list of meshes) {
        for (const mesh of list) {
          if (!mesh) continue
          group?.remove(mesh)
          mesh.dispose()
        }
      }
      for (const cell of colliderCells.values()) removeBody(cell.body)
      colliderCells.clear()
      cache.clear()
    },
  }
}
