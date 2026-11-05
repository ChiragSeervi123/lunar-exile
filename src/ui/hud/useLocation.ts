import { useEffect, useState } from 'react'
import { MOON } from '@/data/moon'
import { createSelenographicFrame, formatSelenographic, getPlanet } from '@/game/planet'
import { playerRuntime } from '@/stores/runtime'
import type { ProvinceKind } from '@/types/content'
import { normalize, vec3 } from '@/utils/vec3'

/** Where the astronaut is on the Moon, for the HUD. */
export interface PlayerLocation {
  /** Name of the province underfoot, and what kind of place it is. */
  province: string
  kind: ProvinceKind
  description: string
  side: 'near' | 'far'
  /** Latitude and longitude, formatted. */
  coordinates: string
}

const frame = createSelenographicFrame(MOON.landingCoordinates.latitude, MOON.landingCoordinates.longitude)
const dir = vec3()
const coords = { latitude: 0, longitude: 0 }

function locate(): PlayerLocation | null {
  if (!playerRuntime.active) return null
  normalize(dir, playerRuntime.position)
  const p = getPlanet().provinceAt(dir)
  return {
    province: p.name,
    kind: p.kind,
    description: p.def.description,
    side: p.side,
    coordinates: formatSelenographic(frame.at(dir, coords)),
  }
}

const same = (a: PlayerLocation | null, b: PlayerLocation | null) => a?.province === b?.province && a?.coordinates === b?.coordinates

/**
 * The astronaut's location, refreshed a few times a second (not every frame, so the HUD doesn't
 * re-render constantly), and the first location of this session (where the astronaut arrived).
 */
export function useLocation(intervalMs = 250): { current: PlayerLocation | null; arrival: PlayerLocation | null } {
  const [state, setState] = useState(() => {
    const here = locate()
    return { current: here, arrival: here }
  })
  useEffect(() => {
    const id = setInterval(() => {
      const next = locate()
      setState((prev) => (same(prev.current, next) ? prev : { current: next, arrival: prev.arrival ?? next }))
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return state
}
