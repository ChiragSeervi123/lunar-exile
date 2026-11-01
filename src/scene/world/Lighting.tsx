import { useLayoutEffect, useMemo, useRef } from 'react'
import { Object3D, type DirectionalLight } from 'three'
import type { Terrain } from '@/game/world'
import type { RegionDef } from '@/types/content'
import { directionFromAngles } from '@/utils/math'

interface LightingProps {
  region: RegionDef
  terrain: Terrain
  shadowMapSize: number
  /** Half-width of the shadowed area around the focus point, meters. */
  shadowExtent: number
}

/** Distance of the sun light from its focus; only the direction matters for a directional light. */
const SUN_DISTANCE = 1000

/**
 * Low sun for long shadows and dark crater interiors, a dim sky/ground fill so shadows keep some
 * detail, and faint blue earthshine from Earth's direction.
 */
export function Lighting({ region, terrain, shadowMapSize, shadowExtent }: LightingProps) {
  const sunRef = useRef<DirectionalLight>(null)
  const { sun, earth } = region.sky
  const sunDir = useMemo(() => directionFromAngles(sun.azimuth, sun.elevation), [sun])
  const earthDir = useMemo(() => (earth ? directionFromAngles(earth.azimuth, earth.elevation) : null), [earth])

  // Centre the shadow map ahead of the landing zone, where the cinematic shots look.
  // Milestone 2 will move this focus with the player.
  const target = useMemo(() => {
    const focus = new Object3D()
    const heading = earthDir ?? [-sunDir[0], 0, -sunDir[2]]
    const length = Math.hypot(heading[0], heading[2]) || 1
    focus.position.set(
      terrain.spawn.x + (heading[0] / length) * 60,
      terrain.spawn.y,
      terrain.spawn.z + (heading[2] / length) * 60,
    )
    return focus
  }, [terrain, earthDir, sunDir])

  useLayoutEffect(() => {
    const light = sunRef.current
    if (!light) return
    const camera = light.shadow.camera
    camera.left = -shadowExtent
    camera.right = shadowExtent
    camera.top = shadowExtent
    camera.bottom = -shadowExtent
    camera.near = 10
    camera.far = SUN_DISTANCE * 2.6
    camera.updateProjectionMatrix()
    light.shadow.mapSize.set(shadowMapSize, shadowMapSize)
    // Drop the old shadow map so three allocates one at the new resolution.
    light.shadow.map?.dispose()
    light.shadow.map = null
  }, [shadowMapSize, shadowExtent])

  const { x, y, z } = target.position
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={sunRef}
        target={target}
        position={[x + sunDir[0] * SUN_DISTANCE, y + sunDir[1] * SUN_DISTANCE, z + sunDir[2] * SUN_DISTANCE]}
        color="#fff3e2"
        intensity={5}
        castShadow
        shadow-bias={-0.0004}
        shadow-normalBias={0.45}
      />
      <hemisphereLight args={['#8ea6d4', '#2a2927', 0.26]} />
      {earthDir && (
        <directionalLight
          target={target}
          position={[x + earthDir[0] * SUN_DISTANCE, y + earthDir[1] * SUN_DISTANCE, z + earthDir[2] * SUN_DISTANCE]}
          color="#8fb2ff"
          intensity={0.28}
        />
      )}
    </>
  )
}
