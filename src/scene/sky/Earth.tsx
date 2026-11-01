import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BackSide, Color, Vector3, type ShaderMaterial } from 'three'
import { DEG2RAD } from '@/utils/math'
import { atmosphereShader, earthShader } from './shaders'

interface EarthProps {
  /** Unit direction toward Earth. */
  direction: [number, number, number]
  /** Apparent diameter, degrees. */
  angularSize: number
  sunDirection: [number, number, number]
  /** Distance from the viewer; Earth is drawn inside the camera's far plane. */
  distance: number
}

const AXIAL_TILT = 23.4 * DEG2RAD

/** Atmosphere shells: a tight bright limb and a wide faint haze that stands in for bloom. */
const SHELLS = [
  { scale: 1.06, falloff: 3, intensity: 1.5, color: '#5d9bff' },
  { scale: 1.45, falloff: 2.2, intensity: 0.22, color: '#3f7bff' },
]

export function Earth({ direction, angularSize, sunDirection, distance }: EarthProps) {
  const surface = useRef<ShaderMaterial>(null)
  const radius = distance * Math.tan((angularSize * DEG2RAD) / 2)
  const sun = useMemo(() => new Vector3(...sunDirection), [sunDirection])
  const surfaceArgs = useMemo(
    () => ({ ...earthShader, uniforms: { uSunDir: { value: sun }, uTime: { value: 0 } } }),
    [sun],
  )
  const shellArgs = useMemo(
    () =>
      SHELLS.map((shell) => ({
        ...atmosphereShader,
        uniforms: {
          uSunDir: { value: sun },
          uColor: { value: new Color(shell.color) },
          // Cosine between view and normal at the planet's limb, as seen on this shell.
          uLimb: { value: Math.sqrt(1 - 1 / shell.scale ** 2) },
          uFalloff: { value: shell.falloff },
          uIntensity: { value: shell.intensity },
        },
        side: BackSide,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })),
    [sun],
  )

  useFrame((_, delta) => {
    if (surface.current) surface.current.uniforms.uTime.value += delta
  })

  return (
    <group position={[direction[0] * distance, direction[1] * distance, direction[2] * distance]}>
      <mesh rotation={[0.35, 0, AXIAL_TILT]} scale={radius}>
        <sphereGeometry args={[1, 96, 64]} />
        <shaderMaterial ref={surface} args={[surfaceArgs]} />
      </mesh>
      {SHELLS.map((shell, i) => (
        <mesh key={shell.scale} scale={radius * shell.scale}>
          <sphereGeometry args={[1, 64, 48]} />
          <shaderMaterial args={[shellArgs[i]]} />
        </mesh>
      ))}
    </group>
  )
}
