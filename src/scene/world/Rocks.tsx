import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Euler, Matrix4, Quaternion, Vector3, type BufferGeometry, type InstancedMesh } from 'three'
import { ROCK_CLASSES, ROCK_VARIANTS, scatterRocks, type RockClass, type RockPlacement, type Terrain } from '@/game/world'
import type { RegionDef } from '@/types/content'
import { deriveSeed } from '@/utils/random'
import { createRockGeometry } from './rockGeometry'

/** Shape detail per class: icosahedron subdivisions and surface roughness. */
const SHAPES: Record<RockClass, { detail: number; roughness: number; castShadow: boolean }> = {
  // Debris shadows would be sub-pixel; skipping them keeps the shadow pass cheap.
  debris: { detail: 0, roughness: 0.35, castShadow: false },
  medium: { detail: 1, roughness: 0.32, castShadow: true },
  boulder: { detail: 2, roughness: 0.3, castShadow: true },
}

interface RocksProps {
  region: RegionDef
  terrain: Terrain
  debrisDensity: number
}

/** All rocks in the region: one instanced draw call per rock class and shape variant. */
export function Rocks({ region, terrain, debrisDensity }: RocksProps) {
  const field = useMemo(() => scatterRocks(terrain, region, debrisDensity), [terrain, region, debrisDensity])
  const geometries = useMemo(
    () =>
      ROCK_CLASSES.map((cls) =>
        Array.from({ length: ROCK_VARIANTS }, (_, variant) =>
          createRockGeometry(
            deriveSeed(region.terrain.seed, `${cls}-${variant}`),
            SHAPES[cls].detail,
            SHAPES[cls].roughness,
          ),
        ),
      ),
    [region],
  )
  useEffect(() => () => geometries.flat().forEach((geometry) => geometry.dispose()), [geometries])
  const tint = useMemo(() => new Color(region.palette.rock), [region])

  return ROCK_CLASSES.map((cls, c) =>
    geometries[c].map((geometry, variant) => (
      <RockInstances
        key={`${cls}-${variant}`}
        geometry={geometry}
        placements={field[cls]}
        variant={variant}
        tint={tint}
        castShadow={SHAPES[cls].castShadow}
      />
    )),
  )
}

interface RockInstancesProps {
  geometry: BufferGeometry
  placements: RockPlacement[]
  variant: number
  tint: Color
  castShadow: boolean
}

function RockInstances({ geometry, placements, variant, tint, castShadow }: RockInstancesProps) {
  const ref = useRef<InstancedMesh>(null)
  const rocks = useMemo(() => placements.filter((p) => p.variant === variant), [placements, variant])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const euler = new Euler()
    const position = new Vector3()
    const scale = new Vector3()
    const color = new Color()
    rocks.forEach((rock, i) => {
      rotation.setFromEuler(euler.set(rock.pitch, rock.yaw, rock.roll, 'XZY'))
      matrix.compose(position.set(rock.x, rock.y, rock.z), rotation, scale.set(rock.sx, rock.sy, rock.sz))
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, color.copy(tint).multiplyScalar(rock.shade))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [rocks, tint])

  if (rocks.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, rocks.length]} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0} />
    </instancedMesh>
  )
}
