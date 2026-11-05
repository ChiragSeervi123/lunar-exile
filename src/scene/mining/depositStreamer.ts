import { PLANET_DEPOSITS } from '@/config/planet'
import type { Deposit, RegionDeposits } from '@/game/mining'
import { DEPOSIT_CELL_DEPTH, nodeKey, nodesWithin, type CubeNode, type PlanetDepositField } from '@/game/planet'
import { clamp } from '@/utils/math'
import { dot, normalize, vec3, type Vec3 } from '@/utils/vec3'

export interface DepositStreamer {
  /**
   * Call every frame with the astronaut's (or, without one, the camera's) position. Returns the new
   * active set when it has changed and all its cells are ready, otherwise null.
   */
  update(center: Vec3): RegionDeposits | null
  /** The active set right now. */
  readonly active: RegionDeposits
}

/**
 * Which deposits are live: the landing site's always (it is small), and the Moon's in the cells
 * around the astronaut. New cells are generated a few per frame within a time budget, and the set
 * only switches once they are all ready, so walking never stalls and nothing pops in near by.
 */
export function createDepositStreamer(landing: RegionDeposits, field: PlanetDepositField, radius: number): DepositStreamer {
  const { updateDistance, budgetMs } = PLANET_DEPOSITS
  const dir = vec3()
  const last = vec3(Number.NaN, Number.NaN, Number.NaN)
  let wanted: { key: number; node: CubeNode }[] = []
  const ready = new Map<number, readonly Deposit[]>()
  let shownKeys = ''
  let active: RegionDeposits = landing

  return {
    get active() {
      return active
    },
    update(center) {
      const R = Math.hypot(center.x, center.y, center.z)
      normalize(dir, center)
      if (!(Math.acos(clamp(dot(dir, last), -1, 1)) * R < updateDistance)) {
        last.x = dir.x
        last.y = dir.y
        last.z = dir.z
        wanted = []
        nodesWithin(dir, radius / R, DEPOSIT_CELL_DEPTH, (n) => {
          wanted.push({ key: nodeKey(n.face, n.depth, n.ix, n.iy), node: { ...n } })
        })
        // Forget cells no longer wanted (the generator keeps its own cache).
        const keep = new Set(wanted.map((w) => w.key))
        for (const key of ready.keys()) if (!keep.has(key)) ready.delete(key)
      }
      const started = performance.now()
      for (const w of wanted) {
        if (ready.has(w.key)) continue
        if (performance.now() - started > budgetMs) return null
        ready.set(w.key, field.cell(w.node))
      }
      const keys = wanted
        .map((w) => w.key)
        .sort((a, b) => a - b)
        .join(',')
      if (keys === shownKeys) return null
      shownKeys = keys
      const list = [...landing.list, ...wanted.flatMap((w) => ready.get(w.key)!)]
      active = { list, byId: new Map(list.map((d) => [d.id, d])) }
      return active
    },
  }
}
