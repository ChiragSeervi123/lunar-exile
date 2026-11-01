# LUNAR EXILE

3D open-world lunar survival game. React + TypeScript + Vite, Three.js / React Three Fiber / Drei / Rapier, Zustand, Tailwind CSS.

```
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check + production build
npm run preview  # serve the production build at http://localhost:4173
npm run lint
```

Imports use the `@/` alias for `src/` (configured in `tsconfig.app.json` and `vite.config.ts`).

## Controls

| Key | Action |
| --- | --- |
| W A S D (or arrow keys) | Move, relative to the camera |
| Shift | Sprint |
| Space | Jump |
| Mouse | Look (click the view to capture the mouse, or drag) |
| V | Switch between third and first person |
| Esc | Pause (also releases the mouse) |

Bindings live in `src/config/input.ts`; mouse sensitivity is in Settings.

## Architecture

Dependencies flow one way, top to bottom. A layer may import from layers above it in this list, never below.

```
utils, types, config, data  ->  game  ->  stores  ->  audio, save, input  ->  scene, ui  ->  app
```

| Folder | Responsibility |
| --- | --- |
| `src/utils/` | Small shared helpers: math, seeded random numbers, simplex noise. |
| `src/types/` | Shapes of data-driven content (`ItemDef`, `EnemyDef`, `RegionDef`, ...). |
| `src/config/` | Tunable constants: physics, collision groups, frame order, camera, player controller feel, graphics presets, key bindings, save settings. |
| `src/data/` | Game content as plain objects keyed by id, plus base player stats. **Add a region, enemy, resource, weapon, item, upgrade, ship, or mission by adding an entry here**; ids are derived with `keyof typeof` so they stay type-checked. |
| `src/game/` | Pure TypeScript game logic per system. **No React, no three.js, no stores.** `world/` generates terrain, craters and rocks and exposes `heightAt` / `normalAt`; `player/` holds the movement motor (acceleration, jumping, gravity) and the animation state machine. |
| `src/stores/` | Zustand stores for state the UI reacts to (game phase, player, settings, input status). `runtime.ts` holds the per-frame player, motion, animation and camera state, mutated in place and never read during render. |
| `src/input/` | The single set of keyboard and mouse listeners, live input state, and pointer lock. Gameplay keys are only taken while playing. |
| `src/audio/` | Sound manifest and `playSound` (UI sounds are synthesised; file sounds come later). |
| `src/save/` | Snapshots stores to `localStorage` and restores them (versioned, with migrations). |
| `src/scene/` | React Three Fiber components: `world/` (terrain, rocks and their colliders, lighting), `sky/` (stars, Earth, sun), `player/` (the astronaut, its character controller and procedural animation), `camera/` (menu shot, third- and first-person follow). |
| `src/ui/` | DOM UI with Tailwind: `components/`, `menus/`, `hud/`, `hooks/`. UI never touches saving directly; it receives callbacks. |
| `src/app/` | Startup (`bootstrap.ts`), session flow (`session.ts`: new game, continue, pause, exit, mouse capture), top-level composition (`GameRoot`, `GameCanvas`), and a read-only debug handle (`debug.ts`). |

### The lunar world

A region (`src/data/regions.ts`) describes its world as data: terrain seed and relief, crater tiers and hand-placed landmark craters, the horizon mountain ring, rock densities, sun and Earth positions, fog and surface colours. From that:

1. `game/world/terrain.ts` builds a deterministic height function: rolling noise, every crater's profile (bowl, raised irregular rim, central peak, ejecta rays), the mountain ring, and a levelled landing zone.
2. `game/world/rocks.ts` scatters debris, rocks, boulders and crater-rim formations. Boulders and rocks never depend on graphics quality, so they can safely be obstacles.
3. `scene/world/` turns these into a low-poly mesh (fine grid over the playable area, rings that coarsen toward the horizon), instanced rocks, a Rapier heightfield for the ground, and rounded-box colliders for boulders and rocks (one fixed body).

A new region (e.g. Dust Plains or Crater Valley) is a new entry in `REGIONS` with its own parameters.

### The astronaut

Every frame runs in a fixed order (`FRAME_PRIORITY` in `config/game.ts`):

1. **Input** (`input/`): DOM listeners record held keys, mouse movement and jump presses.
2. **Physics** (60 Hz fixed step): `scene/player/playerController.ts` runs the pure motor from `game/player/movement.ts`, then moves the kinematic capsule with Rapier's character controller (swept shape casts against the terrain and rocks: slopes, steps, snapping to the ground). The exact terrain height is a safety net for grounding and tunnelling.
3. **Player** (after physics): publishes the interpolated position; the model picks its animation state from the physics state and poses its joints procedurally.
4. **Camera** (`scene/camera/CameraRig.tsx`): applies mouse-look and follows the player in third person (sphere-cast collision keeps it out of terrain and rocks) or first person (body hidden from the camera but still casting its shadow).
5. **Followers**: the sky and the sun's shadow area, which tracks the player in texel-sized steps so shadows don't shimmer.

To replace the procedural astronaut with a rigged GLTF model, swap `AstronautModel.tsx`: it only reads `playerRuntime`, `playerMotion` and `cameraRuntime`.

### Adding things

- **New content** (enemy, weapon, region, mission, ...): add an entry in the matching `src/data/*.ts` file.
- **New system**: put rules in `src/game/<system>/`, state in a store, visuals in `src/scene/<system>/`, UI in `src/ui/<system>/`. Folders under `scene/` and `ui/` are created when their first component exists.
- **Persistent state**: add it to `SaveData` in `src/save/saveGame.ts`, bump `SAVE.version` in `src/config/game.ts` and add a migration for older saves.
- **Credits**: edit `src/data/credits.ts`.

### Debugging

In development (or any build with `?debug` in the URL), `window.__lunarDebug` exposes the live player, motion, animation and camera state and the stores, read-only by convention, for inspection and automated tests.

## Current status: Milestone 2

A playable astronaut on the procedural landing site: camera-relative movement with sprinting and lunar jumps, Rapier character physics on the terrain and against rocks, third- and first-person cameras with mouse-look, procedural idle/walk/run/jump/fall/land animation, shadows that follow the player, and a saved position that Continue restores. Survival values are fixed at 100; no consumption, mining or combat yet.
