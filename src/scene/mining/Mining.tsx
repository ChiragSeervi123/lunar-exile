import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, PerspectiveCamera } from 'three'
import { FRAME_PRIORITY } from '@/config/game'
import { PLANET_DEPOSITS } from '@/config/planet'
import { getTool } from '@/data/tools'
import type { Deposit, RegionDeposits } from '@/game/mining'
import { getLandingDeposits, getPlanetDeposits } from '@/game/planet'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { playerRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'
import type { RegionDef } from '@/types/content'
import { directionFromAngles } from '@/utils/math'
import { createSkyReflection } from '../reflection'
import { DepositColliders } from './DepositColliders'
import { createDepositAssets, createDepositField, type DepositField as Field } from './depositField'
import { createDepositStreamer } from './depositStreamer'
import { createMiningEffects } from './miningEffects'
import { MiningSystem } from './MiningSystem'

interface MiningProps {
  region: RegionDef
  /** Most sparks and dust particles alive at once, from the graphics quality. */
  particleBudget: number
}

/**
 * Deposits across the Moon with their colliders, and the mining system and effects. The landing
 * site's deposits are always live; elsewhere, those around the astronaut. Must sit inside <Physics>.
 */
export function Mining({ region, particleBudget }: MiningProps) {
  const deposits = useActiveDeposits()
  return (
    <>
      <DepositField region={region} deposits={deposits.list} />
      <DepositColliders deposits={deposits.list} />
      <MiningSystem deposits={deposits} />
      <MiningEffectsLayer particleBudget={particleBudget} />
    </>
  )
}

/** The live deposits, updated as the astronaut (or, in the menu, the camera) moves. */
function useActiveDeposits(): RegionDeposits {
  const [streamer] = useState(() => createDepositStreamer(getLandingDeposits(), getPlanetDeposits(), PLANET_DEPOSITS.activeRadius))
  const [active, setActive] = useState(() => streamer.active)
  useFrame(({ camera }) => {
    const next = streamer.update(playerRuntime.active ? playerRuntime.position : camera.position)
    if (next) setActive(next)
  }, FRAME_PRIORITY.followers)
  return active
}

/**
 * Draws the live deposits. Shapes and materials are made once; when the set changes a new field
 * is built from them, and deposits that stay keep their look (crumbling, ore, beam heat).
 */
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
  const assets = useMemo(() => createDepositAssets(reflection), [reflection])
  const group = useRef<Group>(null)
  const field = useRef<Field | null>(null)

  useEffect(
    () => () => {
      assets.dispose()
      reflection.dispose()
    },
    [assets, reflection],
  )
  useEffect(() => {
    const root = group.current
    if (!root) return
    const previous = field.current
    const next = createDepositField(deposits, assets, previous?.looks())
    if (previous) {
      root.remove(previous.object)
      previous.dispose()
    }
    root.add(next.object)
    field.current = next
  }, [deposits, assets])
  useEffect(
    () => () => {
      field.current?.dispose()
      field.current = null
    },
    [],
  )
  // A game started or loaded from the menu shows its mined-out deposits at once, without crumbling them.
  useEffect(
    () =>
      useWorldStore.subscribe((state, previous) => {
        if (state.sites !== previous.sites && useGameStore.getState().phase === 'menu') field.current?.snap()
      }),
    [],
  )
  useFrame(
    (state, delta) => field.current?.update(useWorldStore.getState().sites, Math.min(delta, 0.1), state.clock.elapsedTime),
    FRAME_PRIORITY.followers,
  )
  return <group ref={group} />
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
