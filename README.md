# LUNAR EXILE

3D open-world lunar survival game. React + TypeScript + Vite, Three.js / React Three Fiber / Drei / Rapier, Zustand, Tailwind CSS.

```
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build at http://localhost:4173
npm run lint
```

Imports use the `@/` alias for `src/` (configured in `tsconfig.app.json` and `vite.config.ts`).

## Architecture

Dependencies flow one way, top to bottom. A layer may import from layers above it in this list, never below.

```
utils, types, config, data  ->  game  ->  stores  ->  audio, save  ->  scene, ui  ->  app
```

| Folder | Responsibility |
| --- | --- |
| `src/utils/` | Small shared helpers: math, seeded random numbers, simplex noise. |
| `src/types/` | Shapes of data-driven content (`ItemDef`, `EnemyDef`, `RegionDef`, ...). |
| `src/config/` | Tunable constants: physics, camera shots, graphics presets, key bindings, save settings. |
| `src/data/` | Game content as plain objects keyed by id. **Add a region, enemy, resource, weapon, item, upgrade, ship, or mission by adding an entry here**; ids are derived with `keyof typeof` so they stay type-checked. |
| `src/game/` | Pure TypeScript game logic per system. **No React, no three.js, no stores.** `world/` generates terrain, craters and rock placement from a region's data and exposes `heightAt` / `normalAt` for gameplay. |
| `src/stores/` | Zustand stores holding runtime state (game phase, player, inventory, economy, missions, world, settings). The bridge between `game/` logic and the views. |
| `src/audio/` | Sound manifest and `playSound` (UI sounds are synthesised; file sounds come later). |
| `src/save/` | Snapshots stores to `localStorage` and restores them (versioned). |
| `src/scene/` | React Three Fiber components, **rendering only**: `world/` (terrain mesh, rocks, lighting, terrain collider), `sky/` (stars, Earth, sun), `camera/` (cinematic shots and transitions). |
| `src/ui/` | DOM UI with Tailwind: `components/` (menu button, panel, slider, segmented control), `menus/`, `hud/`, `hooks/`. UI never touches saving directly; it receives callbacks. |
| `src/app/` | Startup (`bootstrap.ts`), session flow (`session.ts`: new game, continue, pause, exit), top-level composition (`GameRoot`, `GameCanvas`). |

### The lunar world

A region (`src/data/regions.ts`) describes its world as data: terrain seed and relief, crater tiers and hand-placed landmark craters, the horizon mountain ring, rock densities, sun and Earth positions, fog and surface colours. From that:

1. `game/world/terrain.ts` builds a deterministic height function: rolling noise, every crater's profile (bowl, raised irregular rim, central peak, ejecta rays), the mountain ring, and a levelled landing zone.
2. `game/world/rocks.ts` scatters debris, rocks, boulders and crater-rim formations. Boulders and rocks never depend on graphics quality, so they can safely become obstacles.
3. `scene/world/` turns these into a low-poly mesh (fine grid over the playable area, rings that coarsen toward the horizon), instanced rocks, and a Rapier heightfield collider.

A new region (e.g. Dust Plains or Crater Valley) is a new entry in `REGIONS` with its own parameters.

### Adding things

- **New content** (enemy, weapon, region, mission, ...): add an entry in the matching `src/data/*.ts` file.
- **New system**: put rules in `src/game/<system>/`, state in a store, visuals in `src/scene/<system>/`, UI in `src/ui/<system>/`. Folders under `scene/` and `ui/` are created when their first component exists.
- **Persistent state**: add it to `SaveData` in `src/save/saveGame.ts` and bump `SAVE.version` in `src/config/game.ts` when the shape changes.
- **Credits**: edit `src/data/credits.ts`.

## Current status: Milestone 1

Procedural lunar landing site, space environment (Earth, stars, sun), cinematic main menu with settings and credits, new game / continue / pause flow, and the survival HUD with placeholder values. No player movement or survival mechanics yet.
