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
| Left mouse button (hold) | Mine the deposit under the crosshair; release to stop |
| E | Collect ore left by a mined-out deposit |
| I | Open or close the inventory |
| V | Switch between third and first person |
| Esc | Close the inventory, or pause (also releases the mouse) |

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
| `src/game/` | Pure TypeScript game logic per system. **No React, no three.js, no stores.** `world/` generates terrain, craters and rocks and exposes `heightAt` / `normalAt`; `player/` holds the movement motor (acceleration, jumping, gravity) and the animation state machine; `mining/` places deposits and holds the extraction math and mined-out site rules; `inventory/` holds the backpack rules (stack limits, validation). |
| `src/stores/` | Zustand stores for state the UI reacts to (game phase, player, inventory, world sites, mining target, notifications, settings, input status). `runtime.ts` holds the per-frame player, motion, animation, camera and mining state, mutated in place and never read during render. |
| `src/input/` | The single set of keyboard and mouse listeners, live input state, and pointer lock. Gameplay keys are only taken while playing (the inventory key also while the inventory is open). |
| `src/audio/` | Sound manifest, `playSound` and the mining beam's hum. All current sounds are synthesised; file sounds come later. |
| `src/save/` | Snapshots stores to `localStorage` and restores them (versioned, with migrations, and every field checked on load). |
| `src/scene/` | React Three Fiber components: `world/` (terrain, rocks and their colliders, lighting), `sky/` (stars, Earth, sun), `player/` (the astronaut, its tool, character controller and procedural animation), `camera/` (menu shot, third- and first-person follow), `mining/` (deposits, their colliders, the mining system, beam and particles). |
| `src/ui/` | DOM UI with Tailwind: `components/`, `menus/`, `hud/`, `inventory/`, `hooks/`. UI never touches saving directly; it receives callbacks. |
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
5. **Interaction** (`scene/mining/MiningSystem.tsx`): aims from the centre of this frame's view, mines, and runs the save's play clock (see below).
6. **Followers**: the sky, the sun's shadow area (which tracks the player in texel-sized steps so shadows don't shimmer), deposit animations and mining effects.

To replace the procedural astronaut with a rigged GLTF model, swap `AstronautModel.tsx`: it only reads `playerRuntime`, `playerMotion`, `cameraRuntime` and `miningRuntime`, and writes back where its tool's emitter is.

### Mining and resources

- **Content**: resource types (`data/resources.ts`: rarity, habitat, health, hardness, yield, regrowth time, look), the items they give (`data/items.ts`: stack limit, rarity, colour), rarities (`data/rarities.ts`) and tools (`data/tools.ts`: power, reach, beam colour). A region lists its deposit types and their density per hectare.
- **Placement** (`game/mining/deposits.ts`): deterministic for the region's seed. Rarer types are placed first; each favours its habitat (titanium in dark mare, helium-3 and relics on crater floors, regolith and crystals on rims), and all keep out of the landing zone, off steep slopes, clear of solid rocks and apart from each other. Ids are stable (`region:resource:index`), so saves can refer to them.
- **Aiming** reuses Rapier: each deposit has a rounded-box collider (solid like a rock, except flat dust patches) and a small one for the ore it leaves, on one fixed body, each enabled only while it exists. A ray from the view centre against the `deposits` group picks the target; a second ray against terrain and rocks must not be blocked. Reach is measured from the astronaut's chest, so third person isn't penalised.
- **Mining** is time-based: deposit health falls at `tool.power / hardness` per second while the button is held. At zero the deposit breaks exactly once and leaves its yield as ore; E picks up what fits in the backpack. After the ore is gone, common deposits regrow on the save's play clock; rare ones never do.
- **Saved**: inventory, equipped tool, mined-out deposits, ore left on the ground and the play clock (save version 3; versions 1 and 2 migrate). Aim, partial damage, particles and physics objects are never saved.
- **Rendering**: one instanced mesh per deposit type, one for halos around rare deposits and two for ore, a single beam, contact glow and light, and two fixed-size particle pools whose size follows graphics quality.

A new tool (drill, laser extractor, vacuum) is a new entry in `TOOLS` with its own power and reach; a new resource is an entry in `RESOURCES` plus its item, and a shape in `scene/mining/depositGeometry.ts` if none of the existing ones fit.

### Adding things

- **New content** (enemy, weapon, region, mission, ...): add an entry in the matching `src/data/*.ts` file.
- **New system**: put rules in `src/game/<system>/`, state in a store, visuals in `src/scene/<system>/`, UI in `src/ui/<system>/`. Folders under `scene/` and `ui/` are created when their first component exists.
- **Persistent state**: add it to `SaveData` in `src/save/saveGame.ts`, bump `SAVE.version` in `src/config/game.ts` and add a migration for older saves.
- **Credits**: edit `src/data/credits.ts`.

### Debugging

In development (or any build with `?debug` in the URL), `window.__lunarDebug` exposes the live player, motion, animation, camera, mining and world-clock state, the deposits, and the stores, read-only by convention, for inspection and automated tests. Its one action, `teleport(x, z)`, moves the astronaut for testing.

## Current status: Milestone 3

Mining and resource collection on the landing site: six deposit types from common lunar dust to extremely rare ancient structures, placed by habitat; mining with the basic tool in either camera mode (beam, sparks, dust, heat glow, camera tremble, sounds); ore to collect; an inventory with stack limits; a mining HUD with toasts; and saves that keep the haul and the mined-out deposits. Survival values are fixed at 100; no economy, combat or missions yet.
