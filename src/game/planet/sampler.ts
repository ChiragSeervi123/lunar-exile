import { createSample, getRegionTerrain, type Terrain, type TerrainSample } from '@/game/world'
import type { MoonDef, RegionDef } from '@/types/content'
import { clamp, directionFromAngles, lerp, smoothstep } from '@/utils/math'
import { createSmoothNoise3D, fbm3, ridged3 } from '@/utils/noise'
import { createRng, deriveSeed, randRange } from '@/utils/random'
import { cross, dot, normalize, setVec, vec3, type Vec3 } from '@/utils/vec3'
import { createSphereCrater, createSphereCraterField, type SphereCrater } from './craters'
import { chartCoordinates, createFrame, type ChartPoint, type Frame } from './frame'
import { createCaves, type Cave } from './caves'
import { createBlend, createProvinceField, type Province } from './provinces'

export interface PlanetSample extends TerrainSample {
  /** Index of the province the point belongs to. */
  province: number
  /** Surface tint (linear RGB) and its strength, 0 where the ground is plain grey. */
  tintR: number
  tintG: number
  tintB: number
  tintAmount: number
  /** Rock and boulder density relative to the landing site's. */
  rocks: number
}

export function createPlanetSample(): PlanetSample {
  return { ...createSample(), province: 0, tintR: 0, tintG: 0, tintB: 0, tintAmount: 0, rocks: 1 }
}

export interface Planet {
  radius: number
  seed: number
  provinces: readonly Province[]
  /** The landing-site map: its flat terrain, the radius it covers unchanged and where it has blended out. */
  landing: { terrain: Terrain; pure: number; blend: number }
  /** Lowest and highest ground relative to the radius, meters, with margin. */
  minHeight: number
  maxHeight: number
  /**
   * Ground and surface data at a unit direction. `spacing` is how far apart the caller samples
   * (meters, 0 = full detail): craters and bumps too small to show at that spacing are left out,
   * which keeps distant, coarse terrain cheap and free of aliasing.
   */
  sample(dir: Vec3, out: PlanetSample, spacing?: number): PlanetSample
  /** Ground height above the radius at a unit direction, meters. */
  heightAt(dir: Vec3): number
  /** Distance from the Moon's centre to the ground at a unit direction. */
  surfaceRadius(dir: Vec3, spacing?: number): number
  /** Unit ground normal at a unit direction. */
  normalAt(dir: Vec3, out: Vec3): Vec3
  provinceAt(dir: Vec3): Province
  /** The big named craters: the giant far-side basin first, then the landmark craters (centre direction, radius in meters). */
  landmarks: readonly { dir: Vec3; radius: number }[]
  /** Cave networks under the surface, one per province (see caves.ts). */
  caves: readonly Cave[]
  /** Arrival point on the ground, and the landing site's frame (identical to the flat map's axes). */
  spawn: { position: Vec3; frame: Frame }
  /** Unit directions toward the sun and Earth, fixed in space. */
  sunDirection: Vec3
  earthDirection: Vec3 | null
}

/** The landing-site map is used unchanged out to this distance, and blended into the Moon by the second. */
const CHART_PURE = 320
const CHART_BLEND = 480
/**
 * Ground stays within these heights relative to the radius, with margin (measured: the impact basin
 * floor at about −98 m, mountain peaks at about +163 m). Horizon culling relies on the lower bound.
 */
const MIN_HEIGHT = -140
const MAX_HEIGHT = 220
/** Surface bumps (13 m and 4.5 m wavelengths) are left out of terrain sampled coarser than this, meters. */
const ROUGHNESS_CUTOFF = 13
/** Offset for normals by finite differences, meters (as on the flat map). */
const NORMAL_STEP = 0.75

/**
 * The Moon's ground: a deterministic function of direction. Provinces set the character of each
 * area (relief, mountain ranges, rilles, terraces, crater density, brightness, tint); spherical
 * craters at three sizes plus landmark craters and a giant far-side basin pit the whole surface.
 * Within 320 m of the landing site the flat map of Milestones 1–3 is used exactly, so its craters,
 * rocks and deposits sit where they always did; it blends into the Moon by 480 m.
 */
export function createPlanet(moon: MoonDef, landingRegion: RegionDef, landingRegionId: string): Planet {
  const R = moon.radius
  const seed = moon.seed
  // Ground must be continuous, so only the smooth noise variant is used here.
  const noise = (salt: string) => createSmoothNoise3D(createRng(deriveSeed(seed, salt)))
  const relief = noise('relief')
  const detail = noise('detail')
  const massifs = noise('massifs')
  const ridges = noise('ridges')
  const ridgesFine = noise('ridges-fine')
  const rilles = noise('rilles')
  const albedoNoise = noise('albedo')
  const veins = noise('veins')

  const { sun, earth } = landingRegion.sky
  const sunDirection = vec3(...directionFromAngles(sun.azimuth, sun.elevation))
  const earthDirection = earth ? vec3(...directionFromAngles(earth.azimuth, earth.elevation)) : null
  // Without an Earth, "near side" is simply the hemisphere around the landing site.
  const provinces = createProvinceField(seed, moon.provinces, R, earthDirection ?? vec3(0, 1, 0))
  const landingIndex = provinces.provinces.findIndex((p) => p.kind === 'landing-basin')

  // Landmark craters: the giant basin opposite Earth, and big craters scattered around the Moon
  // (more of them on the older far side), all well away from the landing site.
  const landmarkRng = createRng(deriveSeed(seed, 'landmark-craters'))
  const landmarks: SphereCrater[] = []
  const basin = provinces.provinces.find((p) => p.kind === 'impact-basin')
  if (basin) landmarks.push(createSphereCrater(basin.center, 1100, R, 0.15, landmarkRng))
  const spots: { dir: Vec3; radius: number }[] = basin ? [{ dir: basin.center, radius: 1100 }] : []
  const farPole = earthDirection ? vec3(-earthDirection.x, -earthDirection.y, -earthDirection.z) : vec3(0, -1, 0)
  for (let attempt = 0, placed = 0; placed < 9 && attempt < 2000; attempt++) {
    const dir = normalize(vec3(), vec3(randRange(landmarkRng, -1, 1), randRange(landmarkRng, -1, 1), randRange(landmarkRng, -1, 1)))
    const radius = randRange(landmarkRng, 140, 320)
    const far = dot(dir, farPole) > 0
    // Two thirds of the landmark craters belong on the far side.
    if (!far && placed % 3 !== 0) continue
    if (Math.acos(clamp(dir.y, -1, 1)) * R < 1300 + radius * 1.6) continue
    if (spots.some((s) => Math.acos(clamp(dot(s.dir, dir), -1, 1)) * R < (s.radius + radius) * 1.8)) continue
    // The freshest two get bright ray systems that can be seen from far away.
    const freshness = placed < 2 ? 0.95 : randRange(landmarkRng, 0.2, 0.65)
    landmarks.push(createSphereCrater(dir, radius, R, freshness, landmarkRng))
    spots.push({ dir, radius })
    placed++
  }

  const blend = createBlend()
  const densityBlend = createBlend()
  const maxDensity = Math.max(...provinces.provinces.map((p) => p.def.craters))
  const craters = createSphereCraterField(
    seed,
    R,
    (dir) => provinces.blend(dir, densityBlend).craters,
    maxDensity,
    landmarks,
  )

  const terrain = getRegionTerrain(landingRegionId)
  const flat = createSample()
  const chart: ChartPoint = { x: 0, z: 0, distance: 0 }
  const pos = vec3()

  const sampleGlobal = (dir: Vec3, out: PlanetSample, spacing: number) => {
    setVec(pos, dir.x * R, dir.y * R, dir.z * R)
    const b = provinces.blend(dir, blend)
    let h =
      b.relief * fbm3(relief, pos.x / 520, pos.y / 520, pos.z / 520, 4) +
      b.relief * 0.3 * fbm3(relief, pos.x / 140 + 31.7, pos.y / 140 - 12.3, pos.z / 140 + 5.9, 3) +
      (spacing > ROUGHNESS_CUTOFF ? 0 : b.roughness * (0.7 * detail(pos.x / 13, pos.y / 13, pos.z / 13) + 0.3 * detail(pos.x / 4.5, pos.y / 4.5, pos.z / 4.5)))

    // Mountain ranges: sharp crests gathered into separate massifs. Two single-octave ridge layers
    // rather than a ridged fractal, which piles every octave's slope together into sheer walls;
    // flanks stay mostly climbable, with steep crests.
    // Each feature is skipped only where its blended amplitude is exactly zero, so it fades out at
    // province borders instead of switching off.
    let mountain = 0
    if (b.ridges > 0) {
      const massif = smoothstep(-0.25, 0.55, fbm3(massifs, pos.x / 1400, pos.y / 1400, pos.z / 1400, 2))
      if (massif > 0) {
        const r1 = 1 - Math.abs(ridges(pos.x / 1100, pos.y / 1100, pos.z / 1100))
        const r2 = 1 - Math.abs(ridgesFine(pos.x / 420, pos.y / 420, pos.z / 420))
        const ridge = 0.7 * r1 * r1 + 0.3 * r2 * r2
        h += b.ridges * massif * (0.2 + 0.8 * ridge)
        mountain = massif * ridge
      }
    }
    // Rilles: winding channels along the zero line of a noise field, with flat floors.
    if (b.rilles > 0) {
      const n = Math.abs(fbm3(rilles, pos.x / 900, pos.y / 900, pos.z / 900, 2))
      h -= b.rilles * (1 - smoothstep(0, 0.1, n))
    }
    // Terraces: ground stepped into level shelves with steep, walkable risers. Each riser takes up
    // 60% of a step, so a 1.3 m triangle mesh follows it to within about 35 cm.
    if (b.terraces > 0) {
      const step = 7
      const level = h / step
      const floor = Math.floor(level)
      const stepped = (floor + smoothstep(0.2, 0.8, level - floor)) * step
      h = lerp(h, stepped, Math.min(1, b.terraces / step))
    }

    out.height = h
    out.craterInterior = 0
    out.craterRim = 0
    out.ejecta = 0
    craters.sample(pos, out, spacing)
    out.albedo = clamp(b.albedo + 0.5 * fbm3(albedoNoise, pos.x / 850, pos.y / 850, pos.z / 850, 3), 0, 1)
    out.mountain = mountain
    out.province = b.dominant
    out.rocks = b.rocks
    out.tintR = b.tintR
    out.tintG = b.tintG
    out.tintB = b.tintB
    // Tinted ground shows the colour in veins rather than evenly.
    out.tintAmount = b.tintAmount > 0 ? b.tintAmount * (0.4 + 1.2 * ridged3(veins, pos.x / 140, pos.y / 140, pos.z / 140, 2)) : 0
    return out
  }

  const sample = (dir: Vec3, out: PlanetSample, spacing = 0): PlanetSample => {
    const arc = Math.acos(clamp(dir.y, -1, 1)) * R
    if (arc >= CHART_BLEND) return sampleGlobal(dir, out, spacing)
    chartCoordinates(dir, R, chart)
    terrain.sample(chart.x, chart.z, flat)
    const w = 1 - smoothstep(CHART_PURE, CHART_BLEND, arc)
    if (w >= 1) {
      // Exactly the flat map's ground.
      out.height = flat.height
      out.craterInterior = flat.craterInterior
      out.craterRim = flat.craterRim
      out.ejecta = flat.ejecta
      out.albedo = flat.albedo
      out.mountain = 0
      out.province = landingIndex
      out.rocks = 1
      out.tintR = out.tintG = out.tintB = out.tintAmount = 0
      return out
    }
    sampleGlobal(dir, out, spacing)
    out.height = lerp(out.height, flat.height, w)
    out.craterInterior = lerp(out.craterInterior, flat.craterInterior, w)
    out.craterRim = lerp(out.craterRim, flat.craterRim, w)
    out.ejecta = lerp(out.ejecta, flat.ejecta, w)
    out.albedo = lerp(out.albedo, flat.albedo, w)
    out.mountain *= 1 - w
    out.tintAmount *= 1 - w
    if (w >= 0.5) out.province = landingIndex
    return out
  }

  const scratch = createPlanetSample()
  const heightAt = (dir: Vec3, spacing = 0) => sample(dir, scratch, spacing).height

  const e1 = vec3()
  const e2 = vec3()
  const offset = vec3()
  const helperY = vec3(0, 1, 0)
  const helperX = vec3(1, 0, 0)
  const heightOffset = (dir: Vec3, axis: Vec3, step: number) => {
    const k = step / R
    return heightAt(normalize(offset, setVec(offset, dir.x + axis.x * k, dir.y + axis.y * k, dir.z + axis.z * k)))
  }
  const normalAt = (dir: Vec3, out: Vec3): Vec3 => {
    normalize(e1, cross(e1, Math.abs(dir.y) < 0.9 ? helperY : helperX, dir))
    cross(e2, dir, e1)
    const s = NORMAL_STEP
    const g1 = (heightOffset(dir, e1, s) - heightOffset(dir, e1, -s)) / (2 * s)
    const g2 = (heightOffset(dir, e2, s) - heightOffset(dir, e2, -s)) / (2 * s)
    return normalize(out, setVec(out, dir.x - e1.x * g1 - e2.x * g2, dir.y - e1.y * g1 - e2.y * g2, dir.z - e1.z * g1 - e2.z * g2))
  }

  const spawnDir = vec3(0, 1, 0)
  const caves = createCaves(seed, { radius: R, surfaceRadius: (d) => R + heightAt(d), normalAt }, provinces.provinces)
  return {
    radius: R,
    seed,
    provinces: provinces.provinces,
    landing: { terrain, pure: CHART_PURE, blend: CHART_BLEND },
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    sample,
    heightAt,
    surfaceRadius: (dir, spacing = 0) => R + heightAt(dir, spacing),
    normalAt,
    provinceAt: (dir) => (Math.acos(clamp(dir.y, -1, 1)) * R < (CHART_PURE + CHART_BLEND) / 2 ? provinces.provinces[landingIndex] : provinces.at(dir)),
    landmarks: spots.map((s) => ({ dir: s.dir, radius: s.radius })),
    caves,
    spawn: { position: vec3(0, R + heightAt(spawnDir), 0), frame: createFrame() },
    sunDirection,
    earthDirection,
  }
}
