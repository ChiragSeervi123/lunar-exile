import type { ToolDef } from '@/types/content'

/** Mining tools. Drills, laser extractors and vacuums join here with their own power and range. */
export const TOOLS = {
  'basic-mining-tool': {
    name: 'Basic Mining Tool',
    description: 'Standard-issue cutting beam. Quick on regolith, slow on harder minerals.',
    power: 25,
    range: 4.5,
    beamColor: '#ffb347',
  },
} satisfies Record<string, ToolDef>

export type ToolId = keyof typeof TOOLS

export function getTool(id: string | undefined): ToolDef | undefined {
  return id ? (TOOLS as Record<string, ToolDef>)[id] : undefined
}
