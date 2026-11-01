import { Billboard } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { AdditiveBlending, BackSide, type Group } from 'three'
import { CAMERA } from '@/config/camera'
import { FRAME_PRIORITY } from '@/config/game'
import type { RegionDef } from '@/types/content'
import { directionFromAngles } from '@/utils/math'
import { deriveSeed } from '@/utils/random'
import { Earth } from './Earth'
import { sunShader, starShader } from './shaders'
import { createSkyDomeGeometry, createStarGeometry } from './skyGeometry'

/** Sky objects sit at fixed fractions of the camera's far plane, back to front. */
const DOME_RADIUS = CAMERA.far * 0.9
const STAR_RADIUS = CAMERA.far * 0.85
const SUN_DISTANCE = CAMERA.far * 0.75
const EARTH_DISTANCE = CAMERA.far * 0.45

interface SkyProps {
  region: RegionDef
  starCount: number
}

/** Space backdrop: dome, starfield, sun and Earth, kept centred on the camera so they never get closer. */
export function Sky({ region, starCount }: SkyProps) {
  const { sun, earth, fog } = region.sky
  const sunDir = useMemo(() => directionFromAngles(sun.azimuth, sun.elevation), [sun])
  const earthDir = useMemo(() => (earth ? directionFromAngles(earth.azimuth, earth.elevation) : null), [earth])
  const seed = region.terrain.seed

  return (
    <>
      <color attach="background" args={['#020309']} />
      <fog attach="fog" args={[fog.color, fog.near, fog.far]} />
      <SkyAnchor>
        <SkyDome seed={deriveSeed(seed, 'sky')} />
        <Starfield count={starCount} seed={deriveSeed(seed, 'stars')} />
        <Billboard position={[sunDir[0] * SUN_DISTANCE, sunDir[1] * SUN_DISTANCE, sunDir[2] * SUN_DISTANCE]}>
          <mesh scale={SUN_DISTANCE * 0.09}>
            <planeGeometry />
            <shaderMaterial args={[sunShader]} blending={AdditiveBlending} transparent depthWrite={false} />
          </mesh>
        </Billboard>
        {earth && earthDir && (
          <Earth
            direction={earthDir}
            angularSize={earth.angularSize}
            sunDirection={sunDir}
            distance={EARTH_DISTANCE}
          />
        )}
      </SkyAnchor>
    </>
  )
}

function SkyAnchor({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  // After the camera has moved this frame, so the sky never lags a frame behind it.
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position)
  }, FRAME_PRIORITY.followers)
  return <group ref={ref}>{children}</group>
}

function SkyDome({ seed }: { seed: number }) {
  const geometry = useMemo(() => createSkyDomeGeometry(DOME_RADIUS, seed), [seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={BackSide} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  )
}

function Starfield({ count, seed }: { count: number; seed: number }) {
  const geometry = useMemo(() => createStarGeometry(count, STAR_RADIUS, seed), [count, seed])
  useEffect(() => () => geometry.dispose(), [geometry])
  const dpr = useThree((state) => state.viewport.dpr)
  const args = useMemo(() => ({ ...starShader, uniforms: { uPixelRatio: { value: 1 } } }), [])
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        args={[args]}
        uniforms-uPixelRatio-value={dpr}
        blending={AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </points>
  )
}
