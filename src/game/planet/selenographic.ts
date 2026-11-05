import { DEG2RAD } from '@/utils/math'
import { cross, dot, normalize, vec3, type Vec3 } from '@/utils/vec3'

/** Latitude and longitude on the Moon, degrees: north and east positive, longitude in −180..180. */
export interface Selenographic {
  latitude: number
  longitude: number
}

export interface SelenographicFrame {
  /** Coordinates of a unit direction from the Moon's centre. */
  at(dir: Vec3, out: Selenographic): Selenographic
}

/**
 * Selenographic coordinates fixed by the landing point: it sits at (latitude, longitude), and
 * north there is the flat landing-site map's north (−Z), as the landing point is the +Y pole of
 * world space.
 */
export function createSelenographicFrame(latitude: number, longitude: number): SelenographicFrame {
  const lat = latitude * DEG2RAD
  // The north pole: from the landing point (+Y), north (−Z) by the colatitude.
  const pole = vec3(0, Math.sin(lat), -Math.cos(lat))
  // The landing point's meridian on the equator, and east from it.
  const meridian = normalize(vec3(), vec3(-pole.x * pole.y, 1 - pole.y * pole.y, -pole.z * pole.y))
  const east = cross(vec3(), pole, meridian)
  return {
    at(dir, out) {
      out.latitude = Math.asin(Math.max(-1, Math.min(1, dot(dir, pole)))) / DEG2RAD
      let lon = longitude + Math.atan2(dot(dir, east), dot(dir, meridian)) / DEG2RAD
      if (lon > 180) lon -= 360
      if (lon <= -180) lon += 360
      out.longitude = lon
      return out
    },
  }
}

/** As shown in the UI: "0.67°N 23.47°E". */
export function formatSelenographic({ latitude, longitude }: Selenographic): string {
  const ns = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? 'N' : 'S'}`
  const ew = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? 'E' : 'W'}`
  return `${ns} ${ew}`
}
