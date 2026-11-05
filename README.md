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
| `src/game/` | Pure TypeScript game logic per system. **No React, no three.js, no stores.** `planet/` is the spherical Moon (cube-sphere geometry, provinces, craters, ground sampling, rocks, local frames, selenographic coordinates); `world/` generates the landing site's flat map (terrain, craters, rocks), which the Moon embeds; `player/` holds the movement motor (acceleration, jumping, gravity) and the animation state machine; `mining/` places deposits and holds the extraction math and mined-out site rules; `inventory/` holds the backpack rules (stack limits, validation). |
| `src/stores/` | Zustand stores for state the UI reacts to (game phase, player, inventory, world sites, mining target, notifications, settings, input status). `runtime.ts` holds the per-frame player, motion, animation, camera and mining state, mutated in place and never read during render. |
| `src/input/` | The single set of keyboard and mouse listeners, live input state, and pointer lock. Gameplay keys are only taken while playing (the inventory key also while the inventory is open). |
| `src/audio/` | Sound manifest, `playSound` and the mining beam's hum. All current sounds are synthesised; file sounds come later. |
| `src/save/` | Snapshots stores to `localStorage` and restores them (versioned, with migrations, and every field checked on load). |
| `src/scene/` | React Three Fiber components: `planet/` (streamed terrain chunks and their workers, level of detail, collision tiles, rocks, the Moon's own shadow), `world/` (lighting), `sky/` (stars, Earth, sun), `player/` (the astronaut, its tool, character controller and procedural animation), `camera/` (menu shot, third- and first-person follow), `mining/` (deposits, their colliders, the mining system, beam and particles). |
| `src/ui/` | DOM UI with Tailwind: `components/`, `menus/`, `hud/`, `inventory/`, `hooks/`. UI never touches saving directly; it receives callbacks. |
| `src/app/` | Startup (`bootstrap.ts`), session flow (`session.ts`: new game, continue, pause, exit, mouse capture), top-level composition (`GameRoot`, `GameCanvas`), and a read-only debug handle (`debug.ts`). |

### The Moon

The world is a sphere 3.5 km in radius (`data/moon.ts`), centred on the origin, with no edges or boundaries: a lap is about 22 km. See [docs/milestone-4.md](docs/milestone-4.md) for the full design.

1. `game/planet/sampler.ts` defines the ground as a deterministic function of direction: 42 provinces (`data/provinces.ts`: maria, highlands, mountain ranges, rilles, crater fields, regolith plains, mineral provinces, a giant far-side impact basin, terraced anomalies), each with its own relief, craters, brightness and tint, blended smoothly at their borders; craters at every scale over the whole sphere; and, within 320 m of the landing point, the landing site's flat map (`game/world/`, from `data/regions.ts`) exactly as in Milestones 1–3, blending into the Moon by 480 m.
2. `scene/planet/` draws it as a cube-sphere of 32×32 chunks: finer near the camera, coarser with distance, culled behind the horizon, built in Web Workers and streamed in without holes (skirts hide the steps between levels of detail).
3. Rocks (`game/planet/rocks.ts`) are generated per cell everywhere, in proportion to each province's rockiness; the landing site keeps its own. Ground collision is streamed as triangle-mesh tiles around the player, and rocks near the player get colliders. Boulders and rocks never depend on graphics quality, so they can safely be obstacles.

### The astronaut

Every frame runs in a fixed order (`FRAME_PRIORITY` in `config/game.ts`):

1. **Input** (`input/`): DOM listeners record held keys, mouse movement and jump presses.
2. **Physics** (60 Hz fixed step): `scene/player/planetController.ts` runs the pure motor from `game/player/movement.ts` in the astronaut's own frame (up away from the Moon's centre, carried along the ground), then moves the kinematic capsule, kept upright, with Rapier's character controller (swept shape casts against the ground tiles and rocks: slopes, steps, snapping to the ground). Gravity pulls toward the centre; the exact ground height is a safety net for grounding and tunnelling.
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
- **Saved**: inventory, equipped tool, mined-out deposits, ore left on the ground, the play clock and where the astronaut stands on the Moon (save version 4; versions 1–3 migrate, flat-map positions carried onto the Moon). Aim, partial damage, particles and physics objects are never saved.
- **Rendering**: one instanced mesh per deposit type, one for halos around rare deposits and two for ore, a single beam, contact glow and light, and two fixed-size particle pools whose size follows graphics quality.

A new tool (drill, laser extractor, vacuum) is a new entry in `TOOLS` with its own power and reach; a new resource is an entry in `RESOURCES` plus its item, and a shape in `scene/mining/depositGeometry.ts` if none of the existing ones fit.

### Adding things

- **New content** (enemy, weapon, region, mission, ...): add an entry in the matching `src/data/*.ts` file.
- **New system**: put rules in `src/game/<system>/`, state in a store, visuals in `src/scene/<system>/`, UI in `src/ui/<system>/`. Folders under `scene/` and `ui/` are created when their first component exists.
- **Persistent state**: add it to `SaveData` in `src/save/saveGame.ts`, bump `SAVE.version` in `src/config/game.ts` and add a migration for older saves.
- **Credits**: edit `src/data/credits.ts`.

### Debugging

In development (or any build with `?debug` in the URL), `window.__lunarDebug` exposes the live player, motion, animation, camera, mining and world-clock state, the deposits, the Moon's generator (`planet()`), terrain streaming numbers (`terrain()`) and the stores, read-only by convention, for inspection and automated tests. `map` and `local()` give positions in landing-site map coordinates. Its actions move the astronaut or the camera for testing: `teleport(x, z)` (map coordinates), `teleportTo(direction)` (anywhere on the Moon) and `view(position, target)` (a fixed camera; `view(null)` hands it back).

## Current status: Milestone 4, phases 1–5 of 8

The whole spherical Moon is playable: walk, sprint and jump anywhere on it, including the far side, with the camera, lighting (fixed sun, earthshine, an automatic helmet lamp at night) and mining working on the sphere. Deposits are everywhere: each province has its own resources in their habitats, and the rarer ones are richer the farther you go from the landing site. The HUD shows the province and coordinates underfoot. Still to come in this milestone: exploration and discoveries, caves, and a performance and documentation pass. Survival values are fixed at 100; no economy, combat or missions yet.
