import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { PerspectiveCamera } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { getTool } from '@/data/tools'
import { getRegionDeposits, type Deposit } from '@/game/mining'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useWorldStore } from '@/stores/worldStore'
import type { RegionDef } from '@/types/content'
import { directionFromAngles } from '@/utils/math'
import { createSkyReflection } from '../reflection'
import { DepositColliders } from './DepositColliders'
import { createDepositField } from './depositField'
import { createMiningEffects } from './miningEffects'
import { MiningSystem } from './MiningSystem'

interface MiningProps {
  region: RegionDef
  /** Most sparks and dust particles alive at once, from the graphics quality. */
  particleBudget: number
}

/** The region's deposits with their colliders, and the mining system and effects. Must sit inside <Physics>. */
export function Mining({ region, particleBudget }: MiningProps) {
  const regionId = useWorldStore((s) => s.regionId)
  const deposits = useMemo(() => getRegionDeposits(regionId), [regionId])
  return (
    <>
      <DepositField region={region} deposits={deposits.list} />
      <DepositColliders deposits={deposits.list} />
      <MiningSystem deposits={deposits} />
      <MiningEffectsLayer particleBudget={particleBudget} />
    </>
  )
}

function DepositField({ region, deposits }: { region: RegionDef; deposits: readonly Deposit[] }) {
  const { sun, earth } = region.sky
  const reflection = useMemo(
    () =>
      createSkyReflection(
        directionFromAngles(sun.azimuth, sun.elevation),
        earth ? directionFromAngles(earth.azimuth, earth.elevation) : null,
      ),
    [sun, earth],
  )
  const field = useMemo(() => createDepositField(deposits, reflection), [deposits, reflection])
  useEffect(() => () => reflection.dispose(), [reflection])
  useEffect(() => () => field.dispose(), [field])
  // A game started or loaded from the menu shows its mined-out deposits at once, without crumbling them.
  useEffect(
    () =>
      useWorldStore.subscribe((state, previous) => {
        if (state.sites !== previous.sites && useGameStore.getState().phase === 'menu') field.snap()
      }),
    [field],
  )
  useFrame(
    (state, delta) => field.update(useWorldStore.getState().sites, Math.min(delta, 0.1), state.clock.elapsedTime),
    FRAME_PRIORITY.followers,
  )
  return <primitive object={field.object} />
}

function MiningEffectsLayer({ particleBudget }: { particleBudget: number }) {
  const toolId = useInventoryStore((s) => s.equipment.tool)
  const beamColor = getTool(toolId)?.beamColor ?? '#ffb347'
  const effects = useMemo(() => createMiningEffects(particleBudget, beamColor), [particleBudget, beamColor])
  useEffect(() => () => effects.dispose(), [effects])
  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera
    const pixelScale = state.gl.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360))
    effects.update(Math.min(delta, 0.1), state.clock.elapsedTime, pixelScale)
  }, FRAME_PRIORITY.followers)
  return <primitive object={effects.object} />
}
