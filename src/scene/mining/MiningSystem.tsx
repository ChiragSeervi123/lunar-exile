import { useFrame } from '@react-three/fiber'
import { useRapier, type RapierContext } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { playSound, setBeamSound } from '@/audio/audioManager'
import { COLLISION, FRAME_PRIORITY } from '@/config/game'
import { MINING } from '@/config/mining'
import { getItem } from '@/data/items'
import { RARITIES } from '@/data/rarities'
import { getResource } from '@/data/resources'
import { getTool } from '@/data/tools'
import { spaceFor } from '@/game/inventory'
import {
  DEPOSIT_BOUNDS,
  hasRegrown,
  isPresent,
  mineDeposit,
  miningRate,
  type Deposit,
  type RegionDeposits,
} from '@/game/mining'
import { inputState, isHeld } from '@/input/inputState'
import { saveProgress } from '@/save/saveGame'
import { useGameStore } from '@/stores/gameStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { describesTarget, useMiningStore, type TargetKind } from '@/stores/miningStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { cameraRuntime, miningRuntime, playerRuntime, worldRuntime } from '@/stores/runtime'
import { useWorldStore } from '@/stores/worldStore'
import { viewDirection } from '../camera/follow'
import { depositTargets } from './depositTargets'

type Ray = InstanceType<RapierContext['rapier']['Ray']>

/** A deposit broke: mark it mined out (once), leaving its ore on the ground. */
function breakDeposit(deposit: Deposit): void {
  if (!useWorldStore.getState().breakDeposit(deposit.id, deposit.yield, worldRuntime.playTime)) return
  miningRuntime.health.delete(deposit.id)
  miningRuntime.events.push({ type: 'break', deposit })
  miningRuntime.shake = Math.min(1, miningRuntime.shake + MINING.shake.burst)
  playSound('depositBreak')
  saveProgress()
}

/** Picks up as much of a deposit's ore as the backpack has room for; the rest stays on the ground. */
function collectOre(deposit: Deposit): void {
  const itemId = getResource(deposit.resourceId)?.itemId
  const item = itemId ? getItem(itemId) : undefined
  const available = useWorldStore.getState().sites.drops[deposit.id] ?? 0
  if (!itemId || !item || available <= 0) return
  const notify = useNotificationStore.getState().notify
  // Take only what fits, so the world and the backpack always agree.
  const taken = Math.min(available, spaceFor(useInventoryStore.getState().stacks, itemId))
  if (taken > 0 && useWorldStore.getState().collectOre(deposit.id, taken, worldRuntime.playTime)) {
    useInventoryStore.getState().addItem(itemId, taken)
    notify('gain', itemId, taken)
    miningRuntime.events.push({ type: 'collect', deposit })
    playSound(RARITIES[item.rarity].rank >= RARITIES.rare.rank ? 'collectRare' : 'collect')
    saveProgress()
  }
  if (taken < available) {
    notify('full', itemId, available - taken)
    playSound('storageFull')
  }
}

/** Mined-out deposits whose time has come grow back, unless the astronaut is standing in the way. */
function regrowDeposits(deposits: RegionDeposits): void {
  const { sites, regrowDeposits: regrow } = useWorldStore.getState()
  const ready: string[] = []
  for (const id in sites.depleted) {
    const deposit = deposits.byId.get(id)
    const resource = deposit && getResource(deposit.resourceId)
    if (!deposit || !resource || !hasRegrown(sites, id, resource, worldRuntime.playTime)) continue
    const clearance = DEPOSIT_BOUNDS[resource.appearance.shape].radius * deposit.size + MINING.respawnClearance
    const p = playerRuntime.position
    if (playerRuntime.active && Math.hypot(p.x - deposit.x, p.z - deposit.z) < clearance) continue
    miningRuntime.health.delete(id)
    ready.push(id)
  }
  regrow(ready)
}

/**
 * Aiming and mining, after the camera has moved each frame. The aim is a Rapier ray from the
 * centre of the view against deposit colliders, plus a second ray that terrain and rocks can
 * block. Holding the mine button cuts the target at the tool's rate; at zero health the deposit
 * breaks exactly once, leaving ore that the interact key picks up. Also runs the save's play
 * clock and regrows deposits on it.
 */
export function MiningSystem({ deposits }: { deposits: RegionDeposits }) {
  const { world, rapier } = useRapier()
  const scratch = useRef({ ray: null as Ray | null, dir: new Vector3(), chipIn: 0, regrowIn: 0, beam: false })

  // Never leave the beam humming if the system goes away mid-cut.
  useEffect(() => () => setBeamSound(false), [])

  useFrame((_, delta) => {
    const s = scratch.current
    const m = miningRuntime
    const dt = Math.min(delta, 0.1)
    const phase = useGameStore.getState().phase
    m.shake = Math.max(0, m.shake - MINING.shake.decay * dt)

    if ((phase === 'playing' || phase === 'inventory') && playerRuntime.active) {
      worldRuntime.playTime += dt
      s.regrowIn -= dt
      if (s.regrowIn <= 0) {
        s.regrowIn = MINING.respawnCheckInterval
        regrowDeposits(deposits)
      }
    }

    let target: Deposit | null = null
    let kind: TargetKind = 'deposit'
    let mining = false
    const tool = getTool(useInventoryStore.getState().equipment.tool)
    if (phase === 'playing' && playerRuntime.active) {
      const feet = playerRuntime.renderPosition
      const cam = cameraRuntime.position
      const dir = viewDirection(cameraRuntime.yaw, cameraRuntime.pitch, s.dir)
      // Start the ray just behind the astronaut, so nothing between a third-person camera and the body is picked.
      const along = (feet.x - cam.x) * dir.x + (feet.y + MINING.reachHeight - cam.y) * dir.y + (feet.z - cam.z) * dir.z
      const start = Math.max(0, along - MINING.aimStartBehind)
      const ray = (s.ray ??= new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }))
      ray.origin.x = cam.x + dir.x * start
      ray.origin.y = cam.y + dir.y * start
      ray.origin.z = cam.z + dir.z * start
      ray.dir.x = dir.x
      ray.dir.y = dir.y
      ray.dir.z = dir.z

      const hit = world.castRay(ray, MINING.scanRange + MINING.aimStartBehind, true, undefined, COLLISION.aimQuery)
      const entry = hit ? depositTargets.get(hit.collider.handle) : undefined
      if (hit && entry) {
        const toi = hit.timeOfImpact
        // The store is the truth; a collider switched off this frame may still answer one query.
        const exists = isPresent(useWorldStore.getState().sites, entry.deposit.id, entry.kind)
        const blocked =
          toi > MINING.sightTolerance &&
          world.castRay(ray, toi - MINING.sightTolerance, true, undefined, COLLISION.sightQuery) !== null
        if (exists && !blocked) {
          m.point.x = ray.origin.x + dir.x * toi
          m.point.y = ray.origin.y + dir.y * toi
          m.point.z = ray.origin.z + dir.z * toi
          m.distance = Math.hypot(m.point.x - feet.x, m.point.y - feet.y - MINING.reachHeight, m.point.z - feet.z)
          if (m.distance <= MINING.scanRange) {
            target = entry.deposit
            kind = entry.kind
          }
        }
      }
    }
    m.target = target
    m.targetKind = kind
    m.inRange = target !== null && tool !== undefined && m.distance <= tool.range

    const resource = target ? getResource(target.resourceId) : undefined
    if (target && resource && tool && m.inRange) {
      if (kind === 'deposit' && isHeld('mine')) {
        mining = true
        m.shake = Math.max(m.shake, MINING.shake.mining)
        s.chipIn -= dt
        if (s.chipIn <= 0) {
          s.chipIn = 0.08 + Math.random() * 0.1
          playSound('mineChip')
        }
        if (mineDeposit(m.health, target, miningRate(tool, resource), dt).broke) breakDeposit(target)
      }
      if (kind === 'ore' && inputState.interactQueued) collectOre(target)
    }
    // A press only counts for what is in reach at that moment.
    inputState.interactQueued = false
    m.mining = mining
    if (mining !== s.beam) {
      s.beam = mining
      setBeamSound(mining)
    }

    // Tell the HUD, only when something it shows has changed.
    const full = resource ? spaceFor(useInventoryStore.getState().stacks, resource.itemId) === 0 : false
    const status = useMiningStore.getState()
    if (!describesTarget(status.target, target?.id ?? null, kind, m.inRange, full) || status.mining !== mining) {
      useMiningStore.setState({
        target: target ? { depositId: target.id, kind, resourceId: target.resourceId, inRange: m.inRange, full } : null,
        mining,
      })
    }
  }, FRAME_PRIORITY.interaction)

  return null
}
