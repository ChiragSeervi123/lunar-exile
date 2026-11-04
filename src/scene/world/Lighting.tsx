import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, Vector3, type DirectionalLight, type HemisphereLight, type SpotLight } from 'three'
import { CAMERA } from '@/config/camera'
import { FRAME_PRIORITY } from '@/config/game'
import { RENDER_LAYERS } from '@/config/graphics'
import { chartDirection, frameDirection, type Planet } from '@/game/planet'
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
const LAMP = { intensity: 28, distance: 45, angle: 0.62, penumbra: 0.55, fullAt: -0.02, offAt: 0.09 }

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
    // The sky fill is centred on the local vertical.
    skyRef.current?.position.copy(t.up)
    // Where the sun is down the Moon shades everything already: stop re-rendering the shadow map.
    light.shadow.autoUpdate = elevation > -0.05

    // Helmet lamp: on in the dark, pointing where the astronaut looks, slightly toward the ground.
    // Always present (dark by day), so the lights never change and shaders never recompile.
    const lamp = lampRef.current
    if (lamp) {
      const dark = following ? 1 - smoothstep(LAMP.fullAt, LAMP.offAt, sunDir.dot(t.player.copy(playerRuntime.renderPosition).normalize())) : 0
      t.lamp += (dark - t.lamp) * (1 - Math.exp(-4 * Math.min(delta, 0.1)))
      lamp.intensity = t.lamp * LAMP.intensity
      if (t.lamp > 0.002) {
        const p = playerRuntime.renderPosition
        const f = playerRuntime.renderFrame
        const firstPerson = usePlayerStore.getState().cameraMode === 'first-person' && useGameStore.getState().phase !== 'menu'
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
      <hemisphereLight ref={skyRef} args={['#8ea6d4', '#2a2927', 0.26]} />
      {earthDir && <directionalLight ref={earthRef} target={target} color="#8fb2ff" intensity={0.28} />}
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
    </>
  )
}
