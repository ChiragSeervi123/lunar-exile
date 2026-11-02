import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, Vector3, type DirectionalLight } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { RENDER_LAYERS } from '@/config/graphics'
import { cameraRuntime, playerRuntime } from '@/stores/runtime'
import type { RegionDef } from '@/types/content'
import { directionFromAngles } from '@/utils/math'

interface LightingProps {
  region: RegionDef
  /** Where the main menu looks: the landing point. */
  focus: { x: number; y: number; z: number }
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
/**
 * Shadow depth bias in meters. three applies bias in normalised depth, so it is divided by the
 * shadow camera's depth range; a fixed fraction would grow with the range and lift small objects'
 * shadows off the ground.
 */
const DEPTH_BIAS = 0.04

/**
 * Low sun for long shadows and dark crater interiors, a dim sky/ground fill so shadows keep some
 * detail, and faint blue earthshine from Earth's direction. The shadowed area follows the player.
 */
export function Lighting({ region, focus, shadowMapSize, shadowExtent, followShadowExtent }: LightingProps) {
  const sunRef = useRef<DirectionalLight>(null)
  const earthRef = useRef<DirectionalLight>(null)
  const { sun, earth } = region.sky
  const sunDir = useMemo(() => new Vector3(...directionFromAngles(sun.azimuth, sun.elevation)), [sun])
  const earthDir = useMemo(
    () => (earth ? new Vector3(...directionFromAngles(earth.azimuth, earth.elevation)) : null),
    [earth],
  )
  // The shadow camera's axes across the light's view, as three's lookAt builds them.
  const lightAxes = useMemo(() => {
    const right = new Vector3(0, 1, 0).cross(sunDir).normalize()
    return { right, up: new Vector3().crossVectors(sunDir, right) }
  }, [sunDir])
  // Behind the main menu, centre the shadows ahead of the landing zone, where the camera looks.
  const menuFocus = useMemo(() => {
    const heading = earthDir ?? sunDir.clone().negate()
    const length = Math.hypot(heading.x, heading.z) || 1
    return new Vector3(focus.x + (heading.x / length) * 60, focus.y, focus.z + (heading.z / length) * 60)
  }, [focus, earthDir, sunDir])
  const target = useMemo(() => new Object3D(), [])
  const tracking = useRef({ focus: new Vector3(), snapped: new Vector3(Number.NaN, 0, 0), extent: 0 })

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

  useFrame(() => {
    const light = sunRef.current
    if (!light) return
    const t = tracking.current
    const following = playerRuntime.active
    const extent = following ? followShadowExtent : shadowExtent
    if (following) {
      const p = playerRuntime.renderPosition
      const ahead = extent * LOOK_AHEAD
      t.focus.set(p.x + Math.sin(cameraRuntime.yaw) * ahead, p.y, p.z - Math.cos(cameraRuntime.yaw) * ahead)
    } else t.focus.copy(menuFocus)

    // Move in whole shadow-map texels across the light's view, so shadow edges stay put instead of shimmering.
    const texel = (2 * extent) / shadowMapSize
    const across = Math.round(t.focus.dot(lightAxes.right) / texel) * texel
    const up = Math.round(t.focus.dot(lightAxes.up) / texel) * texel
    const along = t.focus.dot(sunDir)
    t.focus.copy(lightAxes.right).multiplyScalar(across).addScaledVector(lightAxes.up, up).addScaledVector(sunDir, along)
    if (t.focus.equals(t.snapped) && extent === t.extent) return
    t.snapped.copy(t.focus)

    target.position.copy(t.focus)
    target.updateMatrixWorld()
    light.position.copy(t.focus).addScaledVector(sunDir, SUN_DISTANCE)
    if (earthRef.current && earthDir) earthRef.current.position.copy(t.focus).addScaledVector(earthDir, SUN_DISTANCE)
    if (extent !== t.extent) {
      // A low sun stretches the shadowed area along the ground, so the depth range must reach
      // extent / tan(elevation) either side of the focus.
      const reach = extent / Math.tan(Math.max(sunDir.y, 0.05)) + RELIEF
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
    }
  }, FRAME_PRIORITY.followers)

  return (
    <>
      <primitive object={target} />
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
      <hemisphereLight args={['#8ea6d4', '#2a2927', 0.26]} />
      {earthDir && <directionalLight ref={earthRef} target={target} color="#8fb2ff" intensity={0.28} />}
    </>
  )
}
