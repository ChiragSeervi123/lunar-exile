import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { playSound } from '@/audio/audioManager'
import { MOON } from '@/data/moon'
import { getRegion } from '@/data/regions'
import { getDiscoverySites, getPlanet } from '@/game/planet'
import { saveProgress } from '@/save/saveGame'
import { useExplorationStore } from '@/stores/explorationStore'
import { useGameStore } from '@/stores/gameStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { playerRuntime } from '@/stores/runtime'
import { clamp } from '@/utils/math'
import { dot, normalize, vec3 } from '@/utils/vec3'

/** How often the astronaut's whereabouts are checked, seconds. */
const INTERVAL = 0.25
/** A new province counts once the astronaut has stayed in it this long (no flicker on borders), seconds. */
const SETTLE = 1.2

/**
 * Exploration: notices which province the astronaut is in (a banner on arriving, "new discovery"
 * the first time) and the places found along the way (landmark craters, alien structures, cave
 * entrances), records them for the save, and announces them.
 */
export function ExplorationSystem() {
  const state = useRef({ wait: 0, shown: '', candidate: '', since: 0, dir: vec3() })

  useFrame((_, delta) => {
    const s = state.current
    if (useGameStore.getState().phase !== 'playing' || !playerRuntime.active) {
      // A new session starts with a banner for wherever it begins.
      if (!playerRuntime.active) s.shown = ''
      return
    }
    s.wait -= delta
    if (s.wait > 0) return
    s.wait = INTERVAL
    const planet = getPlanet()
    const dir = normalize(s.dir, playerRuntime.position)
    const exploration = useExplorationStore.getState()

    // Provinces: once settled in one, announce it.
    const province = planet.provinceAt(dir)
    if (province.id !== s.candidate) {
      s.candidate = province.id
      s.since = 0
    } else s.since += INTERVAL
    if (s.since >= SETTLE && province.id !== s.shown) {
      const arrival = s.shown === ''
      s.shown = province.id
      const first = exploration.discoverProvince(province.id)
      const text = province.kind === 'landing-basin' ? getRegion(MOON.landingRegion).description : province.def.description
      exploration.showBanner({
        kicker: first ? 'NEW DISCOVERY' : 'ENTERING',
        title: province.name,
        text: `${province.side === 'far' ? 'Far side' : 'Near side'} · ${province.def.label}. ${text}`,
        discovery: first,
        arrival,
      })
      if (first) saveProgress()
    }

    // Places: found by coming close.
    let found = false
    for (const site of getDiscoverySites()) {
      if (Math.acos(clamp(dot(site.dir, dir), -1, 1)) * planet.radius > site.radius) continue
      if (!exploration.discoverSite(site.id)) continue
      useNotificationStore.getState().discover(site.name, site.description)
      found = true
    }
    if (found) {
      playSound('collectRare')
      saveProgress()
    }
  })

  return null
}
