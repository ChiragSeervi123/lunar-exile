import { MOON } from '@/data/moon'
import { getRegionDeposits } from '@/game/mining'
import {
  chartCoordinates,
  chartDirection,
  fromCaveLocal,
  DEPOSIT_CELL_DEPTH,
  getCaveDeposits,
  getDiscoverySites,
  getLandingDeposits,
  getPlanet,
  getPlanetDeposits,
  nodesWithin,
  toLocal,
} from '@/game/planet'
import { inputState } from '@/input/inputState'
import { planetTerrainStatus } from '@/scene/planet/terrainStatus'
import { useCaveStore } from '@/stores/caveStore'
import { useExplorationStore } from '@/stores/explorationStore'
import { useGameStore } from '@/stores/gameStore'
import { useInputStore } from '@/stores/inputStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useMiningStore } from '@/stores/miningStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, miningRuntime, playerAnimation, playerMotion, playerRuntime, worldRuntime } from '@/stores/runtime'
import { useSettingsStore } from '@/stores/settingsStore'
import { useWorldStore } from '@/stores/worldStore'
import { cross, length, normalize, vec3, type Vec3 } from '@/utils/vec3'

declare global {
  interface Window {
    __lunarDebug?: unknown
  }
}

/**
 * Read-only handles for automated testing and inspection: in development, or with ?debug in the
 * URL. World positions have the Moon's centre at the origin; "map" coordinates are the landing
 * site's flat map (x east, z south, meters from the landing point, y above the Moon's radius),
 * which match Milestones 1–3 within 320 m of the landing point.
 */
export function exposeDebugHandles(): void {
  if (!import.meta.env.DEV && !new URLSearchParams(window.location.search).has('debug')) return
  const planet = getPlanet()
  const R = planet.radius
  const toWorld = (x: number, y: number, z: number) => {
    const d = chartDirection(x, z, R, vec3())
    return vec3(d.x * (R + y), d.y * (R + y), d.z * (R + y))
  }
  const toMap = (p: Vec3) => {
    const d = normalize(vec3(), p)
    const c = chartCoordinates(d, R, { x: 0, z: 0, distance: 0 })
    return { x: c.x, y: length(p) - R, z: c.z, distance: c.distance, aboveGround: length(p) - planet.surfaceRadius(d) }
  }
  const heightAt = (x: number, z: number) => planet.heightAt(chartDirection(x, z, R, vec3()))
  window.__lunarDebug = {
    player: playerRuntime,
    motion: playerMotion,
    animation: playerAnimation,
    camera: cameraRuntime,
    input: inputState,
    mining: miningRuntime,
    world: worldRuntime,
    /** The Moon's generator, for sampling ground and provinces. */
    planet: () => planet,
    /** Terrain streaming numbers. */
    terrain: () => ({ ...planetTerrainStatus }),
    /** Ground height at map point (x, z), meters above the Moon's radius. */
    heightAt,
    /** The landing zone on the map. */
    spawn: () => planet.landing.terrain.spawn,
    /** World position of map point (x, z) at height y above the radius. */
    toWorld,
    /** Map coordinates of a world position, with its height above the ground. */
    toMap,
    /** The astronaut's feet on the map. */
    local: () => toMap(playerRuntime.position),
    /** Yaw (in the astronaut's frame) and pitch from `from` toward `to`, both world positions: for aiming the camera. */
    aim: (from: Vec3, to: Vec3) => {
      const l = toLocal(playerRuntime.frame, vec3(to.x - from.x, to.y - from.y, to.z - from.z), vec3())
      return { yaw: Math.atan2(l.x, -l.z), pitch: Math.atan2(l.y, Math.hypot(l.x, l.z)) }
    },
    /** The landing site's deposits on the Moon (world positions). */
    deposits: () => getLandingDeposits().list,
    /** Deposits across the Moon within `radius` meters of the astronaut, nearest first (the landing site's and caves' included). */
    nearbyDeposits: (radius = 120) => {
      const here = playerRuntime.position
      const dir = normalize(vec3(), here)
      const found = [...getLandingDeposits().list]
      nodesWithin(dir, radius / R, DEPOSIT_CELL_DEPTH, (n) => found.push(...getPlanetDeposits().cell({ ...n })))
      for (const cave of planet.caves) {
        const o = cave.origin
        if (Math.hypot(o.x - here.x, o.y - here.y, o.z - here.z) < radius + 80) found.push(...getCaveDeposits(cave.id))
      }
      const away = (d: Vec3) => Math.hypot(d.x - here.x, d.y - here.y, d.z - here.z)
      return found.filter((d) => away(d) <= radius).sort((a, b) => away(a) - away(b))
    },
    /** The same deposits as generated on the flat map in Milestone 3. */
    flatDeposits: () => getRegionDeposits(MOON.landingRegion).list,
    /**
     * Everything in map coordinates, for checks written against the landing-site map: the
     * astronaut's feet, the camera, and the deposits where they stand on the Moon.
     */
    map: {
      get player() {
        return toMap(playerRuntime.position)
      },
      get camera() {
        return toMap(cameraRuntime.position)
      },
      deposits: () => getLandingDeposits().list.map((d) => ({ ...d, ...toMap(d) })),
    },
    /** Fixes the camera at a world position looking at a target (null hands it back to the rig). */
    view: (position: Vec3 | null, target?: Vec3, up?: Vec3) => {
      cameraRuntime.override = position && target ? { position, target, up: up ?? normalize(vec3(), position) } : null
    },
    /** Moves the astronaut's feet to map point (x, z) at the next physics step. */
    teleport: (x: number, z: number) => {
      playerRuntime.teleport = toWorld(x, heightAt(x, z), z)
    },
    /** Moves the astronaut to the ground at a world direction, anywhere on the Moon. */
    teleportTo: (dir: Vec3) => {
      const d = normalize(vec3(), dir)
      const r = planet.surfaceRadius(d)
      playerRuntime.teleport = vec3(d.x * r, d.y * r, d.z * r)
    },
    /** Every province: name, kind and side, for `goTo`. */
    provinces: () => planet.provinces.map((p) => `${p.name} (${p.kind}, ${p.side} side)`),
    /** Moves the astronaut into a cave (by id or name), onto the floor of its first chamber. */
    enterCave: (name: string) => {
      const cave = planet.caves.find((c) => c.id === name || c.name.toLowerCase() === name.toLowerCase())
      if (!cave) return 'no such cave; see sites()'
      const c = cave.chambers[0].c
      // Well inside the chamber; the body falls to its floor.
      playerRuntime.teleport = fromCaveLocal(cave, vec3(c.x, c.y - cave.chambers[0].r * 0.4, c.z), vec3())
      return cave.name
    },
    /** Every crater, structure and cave to find: name, kind and id, for `goTo`. */
    sites: () => getDiscoverySites().map((s) => `${s.name} (${s.kind}, ${s.id})`),
    /**
     * Moves the astronaut to a province (by name or kind, e.g. 'Aitken Basin', 'mountains') or a
     * place (by name or id, e.g. 'The Great Basin', 'cave-3'). Next to a place, not on top of it.
     */
    goTo: (name: string) => {
      const q = name.toLowerCase()
      const p = planet.provinces.find((x) => x.name.toLowerCase() === q) ?? planet.provinces.find((x) => x.kind === q)
      if (p) {
        const r = planet.surfaceRadius(p.center)
        playerRuntime.teleport = vec3(p.center.x * r, p.center.y * r, p.center.z * r)
        return `${p.name} (${p.kind}, ${p.side} side)`
      }
      const site = getDiscoverySites().find((s) => s.name.toLowerCase() === q || s.id === q)
      if (!site) return `nothing called "${name}"; see provinces() and sites()`
      // Beside it: a cave's mouth or a structure would be in the way; a crater's rim is its edge.
      const offset = (site.kind === 'crater' ? site.radius + 15 : site.clearance + 6) / planet.radius
      const side = normalize(vec3(), cross(vec3(), site.dir, Math.abs(site.dir.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)))
      const d = normalize(vec3(), vec3(site.dir.x + side.x * offset, site.dir.y + side.y * offset, site.dir.z + side.z * offset))
      const r = planet.surfaceRadius(d)
      playerRuntime.teleport = vec3(d.x * r, d.y * r, d.z * r)
      return `${site.name} (${site.kind})`
    },
    stores: {
      game: useGameStore,
      player: usePlayerStore,
      input: useInputStore,
      settings: useSettingsStore,
      inventory: useInventoryStore,
      world: useWorldStore,
      mining: useMiningStore,
      notifications: useNotificationStore,
      exploration: useExplorationStore,
      caves: useCaveStore,
    },
  }
}
