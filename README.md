# LUNAR EXILE

3D open-world lunar survival game. React + TypeScript + Vite, Three.js / React Three Fiber / Drei / Rapier, Zustand, Tailwind CSS.

```
npm run dev      # dev server
npm run build    # type-check + production build
npm run lint
```

Imports use the `@/` alias for `src/` (configured in `tsconfig.app.json` and `vite.config.ts`).

## Architecture

Dependencies flow one way, top to bottom. A layer may import from layers above it in this list, never below.

```
types, config, data  ->  game  ->  stores  ->  save, scene, ui, audio  ->  app
```

| Folder | Responsibility |
| --- | --- |
| `src/types/` | Shapes of data-driven content (`ItemDef`, `EnemyDef`, `WeaponDef`, `MissionDef`, `RegionDef`, ...). |
| `src/config/` | Tunable constants: physics, camera, key bindings, save settings, economy multipliers. |
| `src/data/` | Game content as plain objects keyed by id. **Add a region, enemy, resource, weapon, item, upgrade, ship, or mission by adding an entry here**; ids are derived with `keyof typeof` so they stay type-checked. |
| `src/game/` | Pure TypeScript game logic and types per system: `survival`, `player`, `mining`, `combat`, `ai`, `inventory`, `economy`, `missions`. **No React, no three.js, no stores.** Easy to unit-test. |
| `src/stores/` | Zustand stores holding runtime state (game phase, player, inventory, economy, missions, world, settings). The only bridge between `game/` logic and the views. |
| `src/save/` | Snapshots stores to `localStorage` and restores them (versioned). |
| `src/scene/` | React Three Fiber components, **rendering only** (`world/`, `camera/`, `effects/`). Read state from stores; contain no game rules. |
| `src/ui/` | DOM UI with Tailwind: `hud/` (in-game overlay) and `menus/`. Reusable pieces like `StatBar` live here. |
| `src/audio/` | Sound manifest and `playSound`. |
| `src/app/` | Startup (`bootstrap.ts`), top-level composition (`GameRoot`, `GameCanvas`). |
| `src/utils/` | Small shared helpers. |

### Adding things

- **New content** (enemy, weapon, region, mission, ...): add an entry in the matching `src/data/*.ts` file.
- **New system**: put rules in `src/game/<system>/`, state in a store, visuals in `src/scene/<system>/`, UI in `src/ui/<system>/`. Folders under `scene/` and `ui/` are created when their first component exists, so player, enemy, spaceship, mining and combat visuals have no folder yet.
- **Persistent state**: add it to `SaveData` in `src/save/saveGame.ts` and bump `SAVE.version` in `src/config/game.ts` when the shape changes.

## Current status

Architecture scaffold only. The scene is a flat placeholder terrain with lighting and stars; no gameplay is implemented.
