import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, Vector3, type DirectionalLight, type HemisphereLight, type PointLight, type SpotLight } from 'three'
import { CAMERA } from '@/config/camera'
import { FRAME_PRIORITY } from '@/config/game'
import { RENDER_LAYERS } from '@/config/graphics'
import { chartDirection, frameDirection, getCaveQueries, type Planet } from '@/game/planet'
import { defaultFacing } from '@/game/player'
import { useGameStore } from '@/stores/gameStore'
import { usePlayerStore } from '@/stores/playerStore'
import { cameraRuntime, playerRuntime } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { clamp, smoothstep } from '@/utils/math'
import { vec3 } from '@/utils/vec3'

interface LightingProps {
  region: RegionDef
  planet: Planet
  shadowMapSize: number
  /** Half-width of the shadowed area behind the main menu, meters. */
  shadowExtent: number
  /** Half-width of the shadowed area that travels with the player, meters. */
  followShadowExtent: number
}

/** Distance of the lights from their focus; only the direction matters for a directional light. */
const SUN_DISTANCE = 3000
/** How far ahead of the player, along the view, to centre the shadows (fraction of their half-width). */
const LOOK_AHEAD = 0.35
/** Height range of terrain and rocks around the focus that the shadow depth range must cover, meters. */
const RELIEF = 120
/** Lowest sun the shadow depth range is sized for; a grazing sun's shadows are clipped beyond it, radians. */
const MIN_SHADOW_ELEVATION = 0.14
/**
 * Shadow depth bias in meters. three applies bias in normalised depth, so it is divided by the
 * shadow camera's depth range; a fixed fraction would grow with the range and lift small objects'
 * shadows off the ground.
 */
const DEPTH_BIAS = 0.04
/** Helmet lamp: brightness at full darkness, reach (m), beam half-angle (rad), and the sun's height (sine) where it fades in. */
const LAMP = { intensity: 22, distance: 40, angle: 0.55, penumbra: 0.6, fullAt: -0.02, offAt: 0.09 }
/**
 * Suit light: a dim glow on the camera's side of the astronaut, with the lamp, so in the third
 * person view the body isn't a black cut-out against the lamp's beam. Brightness, reach (m), and
 * how far toward the camera from the chest it sits (m).
 */
const GLOW = { intensity: 1.4, distance: 5, offset: 1.3, chest: 1.1 }
/**
 * Sky/ground fill by day and by night. By day it keeps detail in shadows; at night there is only
 * starlight (and earthshine on the near side, a light of its own), so the helmet lamp matters.
 */
const FILL = { day: 0.26, night: 0.06 }
/** Earthshine brightness on the near side (it fades out underground). */
const EARTHSHINE = 0.28

/**
 * Sunlight fixed in space, so day and night fall where they always do on the Moon; faint blue
 * earthshine from Earth's direction; a dim sky/ground fill around the local vertical so shadows
 * keep some detail; and a helmet lamp that comes on by itself where the sun is down. The sun's
 * shadowed area follows the player. The Moon's own shadow (night) is applied in the materials.
 */
export function Lighting({ region, planet, shadowMapSize, shadowExtent, followShadowExtent }: LightingProps) {
  const sunRef = useRef<DirectionalLight>(null)
  const earthRef = useRef<DirectionalLight>(null)
  const skyRef = useRef<HemisphereLight>(null)
  const lampRef = useRef<SpotLight>(null)
  const glowRef = useRef<PointLight>(null)
  const sunDir = useMemo(() => new Vector3(planet.sunDirection.x, planet.sunDirection.y, planet.sunDirection.z), [planet])
  const earthDir = useMemo(
    () => (planet.earthDirection ? new Vector3(planet.earthDirection.x, planet.earthDirection.y, planet.earthDirection.z) : null),
    [planet],
  )
  // The shadow camera's axes across the light's view, as three's lookAt builds them.
  const lightAxes = useMemo(() => {
    const right = new Vector3(0, 1, 0).cross(sunDir).normalize()
    return { right, up: new Vector3().crossVectors(sunDir, right) }
  }, [sunDir])
  // Behind the main menu, centre the shadows 60 m ahead of the landing zone, where the camera looks.
  const menuFocus = useMemo(() => {
    const heading = defaultFacing(region)
    const spawn = planet.landing.terrain.spawn
    const dir = chartDirection(spawn.x + Math.sin(heading) * 60, spawn.z - Math.cos(heading) * 60, planet.radius, vec3())
    const r = planet.surfaceRadius(dir)
    return new Vector3(dir.x * r, dir.y * r, dir.z * r)
  }, [region, planet])
  const target = useMemo(() => new Object3D(), [])
  const lampTarget = useMemo(() => new Object3D(), [])
  const tracking = useRef({
    focus: new Vector3(),
    snapped: new Vector3(Number.NaN, 0, 0),
    up: new Vector3(),
    player: new Vector3(),
    view: vec3(),
    extent: 0,
    elevation: Number.NaN,
    lamp: 0,
  })

  useLayoutEffect(() => {
    const light = sunRef.current
    if (!light) return
    // The player's body stays in the shadow pass even when hidden from the camera in first person.
    light.shadow.camera.layers.enable(RENDER_LAYERS.shadowOnly)
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    // Drop the old shadow map so three allocates one at the new resolution.
    light.shadow.map?.dispose()
    light.shadow.map = null
    tracking.current.extent = 0
  }, [shadowMapSize])

  useFrame((_, delta) => {
    const light = sunRef.current
    if (!light) return
    const t = tracking.current
    const following = playerRuntime.active
    const extent = following ? followShadowExtent : shadowExtent
    if (following) {
      const p = playerRuntime.renderPosition
      const ahead = frameDirection(playerRuntime.renderFrame, cameraRuntime.yaw, 0, t.view)
      const k = extent * LOOK_AHEAD
      t.focus.set(p.x + ahead.x * k, p.y + ahead.y * k, p.z + ahead.z * k)
    } else t.focus.copy(menuFocus)
    t.up.copy(t.focus).normalize()
    // The sun's height above the local horizon (as a sine).
    const elevation = sunDir.dot(t.up)
    // In a cave: how far underground, faded in over the first few meters (light only comes in at the mouth).
    let underground = 0
    if (following) {
      const p = playerRuntime.renderPosition
      if (getCaveQueries().underground(p, 1) !== null) {
        t.player.copy(p).normalize()
        underground = smoothstep(1.5, 6, planet.surfaceRadius(t.player) - Math.hypot(p.x, p.y, p.z))
      }
    }
    // The sky fill is centred on the local vertical, and fades as the sun sets, and underground.
    const sky = skyRef.current
    if (sky) {
      sky.position.copy(t.up)
      sky.intensity = (FILL.night + (FILL.day - FILL.night) * smoothstep(-0.12, 0.08, elevation)) * (1 - 0.92 * underground)
    }
    if (earthRef.current) earthRef.current.intensity = EARTHSHINE * (1 - underground)
    // Where the sun is down the Moon shades everything already: stop re-rendering the shadow map.
    light.shadow.autoUpdate = elevation > -0.05

    // Helmet lamp: on in the dark, pointing where the astronaut looks, slightly toward the ground.
    // Always present (dark by day), so the lights never change and shaders never recompile.
    const lamp = lampRef.current
    const glow = glowRef.current
    if (lamp && glow) {
      const night = following ? 1 - smoothstep(LAMP.fullAt, LAMP.offAt, sunDir.dot(t.player.copy(playerRuntime.renderPosition).normalize())) : 0
      const dark = Math.max(night, underground)
      t.lamp += (dark - t.lamp) * (1 - Math.exp(-4 * Math.min(delta, 0.1)))
      lamp.intensity = t.lamp * LAMP.intensity
      glow.intensity = 0
      if (t.lamp > 0.002) {
        const p = playerRuntime.renderPosition
        const f = playerRuntime.renderFrame
        const firstPerson = usePlayerStore.getState().cameraMode === 'first-person' && useGameStore.getState().phase !== 'menu'
        if (!firstPerson) {
          const c = cameraRuntime.position
          const cx = p.x + f.up.x * GLOW.chest
          const cy = p.y + f.up.y * GLOW.chest
          const cz = p.z + f.up.z * GLOW.chest
          const d = Math.hypot(c.x - cx, c.y - cy, c.z - cz)
          if (d > 0.01) {
            const k = Math.min(GLOW.offset, d * 0.5) / d
            glow.position.set(cx + (c.x - cx) * k, cy + (c.y - cy) * k, cz + (c.z - cz) * k)
            glow.intensity = t.lamp * GLOW.intensity
          }
        }
        const yaw = firstPerson ? cameraRuntime.yaw : playerRuntime.facing
        const pitch = clamp(cameraRuntime.pitch, -0.9, 0.5) * (firstPerson ? 1 : 0.6) - 0.12
        const dir = frameDirection(f, yaw, pitch, t.view)
        const eye = CAMERA.firstPerson.eyeHeight
        lamp.position.set(p.x + f.up.x * eye + dir.x * 0.2, p.y + f.up.y * eye + dir.y * 0.2, p.z + f.up.z * eye + dir.z * 0.2)
        lampTarget.position.set(lamp.position.x + dir.x * 10, lamp.position.y + dir.y * 10, lamp.position.z + dir.z * 10)
        lampTarget.updateMatrixWorld()
      }
    }

    // Move in whole shadow-map texels across the light's view, so shadow edges stay put instead of shimmering.
    const texel = (2 * extent) / shadowMapSize
    const across = Math.round(t.focus.dot(lightAxes.right) / texel) * texel
    const up = Math.round(t.focus.dot(lightAxes.up) / texel) * texel
    const along = t.focus.dot(sunDir)
    t.focus.copy(lightAxes.right).multiplyScalar(across).addScaledVector(lightAxes.up, up).addScaledVector(sunDir, along)
    const rangeStale = extent !== t.extent || !(Math.abs(elevation - t.elevation) < 0.02)
    if (t.focus.equals(t.snapped) && !rangeStale) return
    t.snapped.copy(t.focus)

    target.position.copy(t.focus)
    target.updateMatrixWorld()
    light.position.copy(t.focus).addScaledVector(sunDir, SUN_DISTANCE)
    if (earthRef.current && earthDir) earthRef.current.position.copy(t.focus).addScaledVector(earthDir, SUN_DISTANCE)
    if (rangeStale) {
      // A low sun stretches the shadowed area along the ground, so the depth range must reach
      // extent / tan(elevation) either side of the focus.
      const reach = extent / Math.tan(Math.max(Math.asin(clamp(elevation, -1, 1)), MIN_SHADOW_ELEVATION)) + RELIEF
      const camera = light.shadow.camera
      camera.left = -extent
      camera.right = extent
      camera.top = extent
      camera.bottom = -extent
      camera.near = SUN_DISTANCE - reach
      camera.far = SUN_DISTANCE + reach
      camera.updateProjectionMatrix()
      light.shadow.bias = -DEPTH_BIAS / (camera.far - camera.near)
      t.extent = extent
      t.elevation = elevation
    }
  }, FRAME_PRIORITY.followers)

  return (
    <>
      <primitive object={target} />
      <primitive object={lampTarget} />
      <directionalLight
        ref={sunRef}
        target={target}
        color="#fff3e2"
        intensity={5}
        castShadow
        // Small, so the astronaut's shadow stays attached to its feet. The terrain doesn't need
        // more: it casts from back faces, so sunlit facets never shadow themselves.
        shadow-normalBias={0.04}
      />
      <hemisphereLight ref={skyRef} args={['#8ea6d4', '#2a2927', FILL.day]} />
      {earthDir && <directionalLight ref={earthRef} target={target} color="#8fb2ff" intensity={EARTHSHINE} />}
      <spotLight
        ref={lampRef}
        target={lampTarget}
        color="#eef3ff"
        intensity={0}
        distance={LAMP.distance}
        angle={LAMP.angle}
        penumbra={LAMP.penumbra}
        decay={1.6}
      />
      <pointLight ref={glowRef} color="#cdd6e6" intensity={0} distance={GLOW.distance} decay={2} />
    </>
  )
}
