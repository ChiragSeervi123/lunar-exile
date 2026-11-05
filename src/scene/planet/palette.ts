import { Color } from 'three'
import type { SurfacePaletteDef } from '@/types/content'
import type { ChunkPalette, RGB } from './chunkMesh'

const linear = (hex: string): RGB => {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}

/** A region's surface palette as the linear colours the terrain (and cave rock under it) is built with. */
export function toChunkPalette(palette: SurfacePaletteDef): ChunkPalette {
  return {
    highlands: linear(palette.highlands),
    maria: linear(palette.maria),
    craterFloor: linear(palette.craterFloor),
    ejecta: linear(palette.ejecta),
  }
}
