import { Atom, Boxes, Cpu, Gem, Hexagon, Mountain, Package, Pickaxe, Wind, type LucideIcon, type LucideProps } from 'lucide-react'
import { createElement } from 'react'

/** Icon per item and tool id; anything new falls back to a crate until it gets its own. */
const ICONS: Record<string, LucideIcon> = {
  'lunar-dust': Mountain,
  regolith: Boxes,
  titanium: Hexagon,
  helium3: Atom,
  'alien-crystal': Gem,
  'ancient-component': Cpu,
  'oxygen-canister': Wind,
  'basic-mining-tool': Pickaxe,
}

/** The icon for an item or tool id. */
export function ItemIcon({ id, ...props }: { id: string } & LucideProps) {
  return createElement(ICONS[id] ?? Package, props)
}
