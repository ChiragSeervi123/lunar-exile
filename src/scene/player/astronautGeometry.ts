import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  CylinderGeometry,
  EquirectangularReflectionMapping,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Joint layout of the astronaut, meters. Feet at y = 0, facing -Z. Each limb segment is built
 * around its own pivot so it can rotate at the joint.
 */
export const RIG = {
  /** Pelvis pivot above the feet; the whole upper body hangs off it. */
  pelvisHeight: 0.97,
  /** Hip pivots relative to the pelvis. */
  hip: [0.11, -0.04] as const,
  /** Hip to knee. */
  thigh: 0.44,
  /** Torso pivot (waist) above the pelvis. */
  waist: 0.06,
  /** Shoulder pivots relative to the torso pivot. */
  shoulder: [0.31, 0.42] as const,
  /** Shoulder to elbow. */
  upperArm: 0.3,
  /** Head pivot (neck) above the torso pivot. */
  neck: 0.5,
}

const COLORS = {
  suit: '#e7e5df',
  panel: '#c6c4be',
  dark: '#383c44',
  accent: '#d2692a',
  metal: '#8d939c',
}

type Vec = [number, number, number]

/** One piece of a segment: a primitive with a flat colour, moved into place relative to the pivot. */
function part(
  geometry: BufferGeometry,
  color: string,
  at: Vec = [0, 0, 0],
  rotate: Vec = [0, 0, 0],
  scale: Vec = [1, 1, 1],
): BufferGeometry {
  const piece = geometry.index ? geometry.toNonIndexed() : geometry
  if (piece !== geometry) geometry.dispose()
  piece.deleteAttribute('uv')
  piece.applyMatrix4(
    new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...rotate)), new Vector3(...scale)),
  )
  const { r, g, b } = new Color(color)
  const colors = new Float32Array(piece.getAttribute('position').count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([r, g, b], i)
  piece.setAttribute('color', new BufferAttribute(colors, 3))
  return piece
}

/** Merges a segment's pieces into one mesh, so each segment is a single draw call. */
function segment(pieces: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(pieces)
  pieces.forEach((piece) => piece.dispose())
  if (!merged) throw new Error('Astronaut segment pieces have mismatched attributes')
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

const cylinder = (top: number, bottom: number, height: number, sides = 7) =>
  new CylinderGeometry(top, bottom, height, sides)
const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const rock = (radius: number, detail = 0) => new IcosahedronGeometry(radius, detail)

export interface AstronautGeometry {
  pelvis: BufferGeometry
  torso: BufferGeometry
  helmet: BufferGeometry
  visor: BufferGeometry
  upperArm: BufferGeometry
  forearm: BufferGeometry
  thigh: BufferGeometry
  shin: BufferGeometry
}

/** Low-poly spacesuit, about a thousand triangles. Arms and legs are shared by both sides. */
export function createAstronautGeometry(): AstronautGeometry {
  const { suit, panel, dark, accent, metal } = COLORS
  return {
    pelvis: segment([
      part(box(0.36, 0.2, 0.26), suit),
      part(box(0.38, 0.06, 0.28), dark, [0, 0.08, 0]),
      part(box(0.1, 0.05, 0.03), accent, [0, 0.08, -0.145]),
    ]),
    torso: segment([
      // Faceted chest, flattened front to back.
      part(cylinder(0.255, 0.215, 0.46), suit, [0, 0.23, 0], [0, 0, 0], [1, 1, 0.7]),
      // Chest control unit with status lights.
      part(box(0.22, 0.13, 0.07), dark, [0, 0.27, -0.165]),
      part(box(0.05, 0.025, 0.02), accent, [-0.05, 0.3, -0.2]),
      part(box(0.04, 0.025, 0.02), metal, [0.045, 0.3, -0.2]),
      // Life-support backpack with twin oxygen tanks.
      part(box(0.42, 0.52, 0.2), panel, [0, 0.27, 0.24]),
      part(cylinder(0.065, 0.065, 0.44, 8), metal, [-0.12, 0.27, 0.37]),
      part(cylinder(0.065, 0.065, 0.44, 8), metal, [0.12, 0.27, 0.37]),
      part(cylinder(0.07, 0.07, 0.04, 8), accent, [-0.12, 0.51, 0.37]),
      part(cylinder(0.07, 0.07, 0.04, 8), accent, [0.12, 0.51, 0.37]),
      part(cylinder(0.15, 0.17, 0.07, 10), dark, [0, 0.48, 0]),
    ]),
    helmet: segment([
      part(rock(0.2, 1), suit, [0, 0.15, 0]),
      part(box(0.05, 0.05, 0.08), dark, [-0.175, 0.21, -0.05]),
      part(box(0.05, 0.05, 0.08), dark, [0.175, 0.21, -0.05]),
    ]),
    // Front of a slightly larger sphere: wide band across the face.
    visor: (() => {
      const visor = new SphereGeometry(0.206, 12, 6, Math.PI * 1.5 - 1.2, 2.4, 1.05, 1.0)
      visor.translate(0, 0.15, 0)
      return visor
    })(),
    upperArm: segment([
      part(rock(0.115), suit, [0, -0.01, 0]),
      part(cylinder(0.08, 0.07, 0.28), suit, [0, -0.16, 0]),
      part(cylinder(0.084, 0.084, 0.05), accent, [0, -0.08, 0]),
    ]),
    forearm: segment([
      part(cylinder(0.07, 0.064, 0.25), suit, [0, -0.125, 0]),
      part(cylinder(0.076, 0.076, 0.045), dark, [0, -0.255, 0]),
      part(rock(0.07), dark, [0, -0.33, -0.01], [0, 0, 0], [0.9, 1.25, 1]),
    ]),
    thigh: segment([
      part(cylinder(0.1, 0.085, 0.42), suit, [0, -0.21, 0]),
      part(rock(0.07), panel, [0, -0.43, -0.06], [0, 0, 0], [1, 1, 0.6]),
    ]),
    shin: segment([
      part(cylinder(0.085, 0.075, 0.36), suit, [0, -0.19, 0]),
      part(box(0.15, 0.11, 0.28), dark, [0, -0.435, -0.035]),
      part(box(0.16, 0.03, 0.3), metal, [0, -0.475, -0.035]),
    ]),
  }
}

type Direction = [number, number, number]

/** Equirectangular texture coordinates of a direction, matching three's equirect lookup. */
function equirect(d: Direction): [number, number] {
  const u = Math.atan2(d[2], d[0]) / (Math.PI * 2) + 0.5
  const v = Math.asin(Math.min(1, Math.max(-1, d[1]))) / Math.PI + 0.5
  return [u, 1 - v]
}

/**
 * A tiny painted environment for the visor to reflect: black sky, the bright regolith horizon, the
 * sun and Earth. Far cheaper than rendering a real environment map.
 */
function createVisorEnvironment(sun: Direction, earth: Direction | null): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
    sky.addColorStop(0, '#020309')
    sky.addColorStop(0.47, '#0d1424')
    sky.addColorStop(0.5, '#cbc8c0')
    sky.addColorStop(0.62, '#8e8b85')
    sky.addColorStop(1, '#45433f')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const glow = (dir: Direction, radius: number, color: string) => {
      const [u, v] = equirect(dir)
      const x = u * canvas.width
      const y = v * canvas.height
      const spot = ctx.createRadialGradient(x, y, 0, x, y, radius)
      spot.addColorStop(0, color)
      spot.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = spot
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
    glow(sun, 18, 'rgba(255,248,232,1)')
    if (earth) glow(earth, 7, 'rgba(110,165,255,1)')
  }
  const texture = new CanvasTexture(canvas)
  texture.mapping = EquirectangularReflectionMapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

export interface AstronautParts {
  geometry: AstronautGeometry
  suit: MeshStandardMaterial
  visor: MeshStandardMaterial
  dispose(): void
}

export function createAstronautParts(sun: Direction, earth: Direction | null): AstronautParts {
  const geometry = createAstronautGeometry()
  const environment = createVisorEnvironment(sun, earth)
  const suit = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72, metalness: 0.05 })
  // Gold-coated sun visor, like a real EVA helmet.
  const visor = new MeshStandardMaterial({
    color: '#d9b062',
    metalness: 1,
    roughness: 0.16,
    envMap: environment,
    envMapIntensity: 1.3,
  })
  return {
    geometry,
    suit,
    visor,
    dispose() {
      Object.values(geometry).forEach((g) => g.dispose())
      suit.dispose()
      visor.dispose()
      environment.dispose()
    },
  }
}
