import { Color, type BufferGeometry } from 'three'
import { box, cylinder, part, rock, segment, type Vec } from '../lowPoly'
import { SUIT_COLORS } from './astronautGeometry'

/** Where the beam leaves the tool, in the tool's frame: grip at the origin, pointing along -Z. */
export const TOOL_TIP: Vec = [0, 0.035, -0.29]

/** Emitter lens colours, idle and firing. */
export const LENS_IDLE = new Color('#6b4316')
export const LENS_FIRING = new Color('#ffd49a')

/**
 * The basic mining tool: a pistol-grip cutter with an amber-striped body and an emitter barrel.
 * Shared by the astronaut's hand and the first-person view. Other tools would get their own model here.
 */
export function createMiningToolGeometry(): BufferGeometry {
  const { panel, dark, accent, metal } = SUIT_COLORS
  return segment([
    part(box(0.045, 0.11, 0.05), dark, [0, -0.04, 0.01], [0.25, 0, 0]),
    part(box(0.075, 0.075, 0.24), panel, [0, 0.035, -0.07]),
    part(box(0.078, 0.02, 0.06), accent, [0, 0.035, -0.02]),
    part(box(0.05, 0.03, 0.12), dark, [0, 0.085, -0.05]),
    part(cylinder(0.026, 0.032, 0.09, 8), metal, [0, 0.035, -0.235], [Math.PI / 2, 0, 0]),
    part(cylinder(0.034, 0.034, 0.018, 8), dark, [0, 0.035, -0.19], [Math.PI / 2, 0, 0]),
  ])
}

/** The emitter lens at the barrel's mouth, drawn separately so it can light up. */
export function createLensGeometry(): BufferGeometry {
  return cylinder(0.02, 0.02, 0.01, 8).rotateX(Math.PI / 2).translate(0, 0.035, -0.282)
}

/** Glove and forearm reaching into the first-person view from the lower right, in the tool's frame. */
export function createViewArmGeometry(): BufferGeometry {
  const { suit, dark, accent } = SUIT_COLORS
  const toward = Math.PI / 2 + 0.25
  return segment([
    part(rock(0.055), dark, [0, -0.01, 0.02], [0, 0, 0], [0.9, 1, 1.2]),
    part(cylinder(0.055, 0.06, 0.4, 8), suit, [0.02, -0.06, 0.22], [toward, 0, 0]),
    part(cylinder(0.063, 0.063, 0.035, 8), accent, [0.012, -0.03, 0.09], [toward, 0, 0]),
  ])
}
