# Milestone 4: the spherical Moon

**Status: phases 1–4 of 8 done, paused for review.** The whole Moon is playable. Deposits across the Moon, exploration, caves, and the final performance and documentation pass follow after review.

Approved defaults: a Moon 3.5 km in radius; sunlight fixed in space, with earthshine and a helmet lamp; Git with a baseline commit of Milestone 3.

## Phases

| Phase | Content | Status |
| --- | --- | --- |
| 1 | Sphere sampler: cube-sphere, provinces, craters, landing-site map | Done |
| 2 | Terrain chunks, level of detail, Web Worker streaming, horizon culling | Done |
| 3 | Planetary physics: collision tiles, controller, rocks | Done |
| 4 | Cameras, lighting, mining on the sphere, save v4, switch-over | Done |
| 5 | Deposits across the Moon (deeper and farther means rarer) | Next |
| 6 | Exploration: discovering provinces and landmarks, alien structures | |
| 7 | Caves: hybrid interiors, mineable dust | |
| 8 | Performance pass, documentation | |

## How it works

### The sphere

- **Shape.** The Moon is a cube projected onto a sphere, using an equi-angular mapping so cell sizes stay within 1.4× of each other. Its centre is at the world origin, and the landing site sits at the +Y pole, where world axes match the flat map of Milestones 1–3 (east +X, north −Z). No floating origin is needed: at 3.5 km a float32 coordinate is precise to about 0.24 mm.
- **Ground.** The ground is a pure function of direction (`game/planet/sampler.ts`).
  - The surface is divided into 42 provinces of 11 kinds. They are placed on a jittered Fibonacci lattice, near or far side by Earth's direction, and blended with domain-warped, smooth weights.
  - Craters cover the whole sphere in three size tiers, generated per 3D cell on demand. On top of those sit landmark craters and a giant far-side basin, 1100 m in radius.
  - Mountains, rilles and terraces each have their own shaping.
  - The far side is older and rougher: crater cover rises from 5% to 17%, it is brighter, and its relief is 13.7 m against the near side's 21.3 m.
- **Landing site.** Within 320 m of the landing point the ground is the flat map, exactly: the same heights, craters, rocks and deposits. It blends into the Moon by 480 m, through an azimuthal-equidistant "chart" (`game/planet/frame.ts`).
- **Terrain rendering** (`scene/planet/`):
  - **Chunks:** 32×32 quads per chunk in a quadtree per cube face, refined by distance and culled behind the horizon.
  - **Building:** chunks are built in Web Workers, uploaded a few per frame, and swapped in only once complete, so the view never shows holes.
  - **Seams and gaps:** skirts cover the steps between detail levels. Skirts are lit as the ground they hang from and are left out of the shadow pass. Chunk borders follow great circles, so neighbours of different detail meet without slivers.
  - **Detail filtering:** coarse chunks skip craters and bumps too small to show at their spacing.
- **Night.** The Moon shades itself: lit materials drop sunlight and earthshine wherever the line to the light passes through the Moon.

### Walking on it

- **Local frame.** The movement motor is Milestone 2's, unchanged. It runs in the astronaut's own frame: up is away from the centre, and the frame is carried along the ground by parallel transport, so there are no poles and no edges.
- **Rapier.** Rapier's character controller gets `up` set to the local vertical on every step. The capsule is kept upright, and gravity pulls toward the centre.
- **Collision tiles** are the terrain chunks of depth 7: about 43 m across, with 1.3 m between vertices. 99% of the tile surface is within 8.7 cm of the exact ground. Tiles are built in their own worker within 48 m of the player and freed beyond 80 m. A tile the player is about to stand on is built at once.
- **Spawning and teleports** hold the body still for two physics steps while freshly built colliders enter the physics world.
- **Rocks** are generated per 86 m cell everywhere, in proportion to each province's rockiness. The landing site keeps all 569 of its solid rocks in place, and the hand-over at its edge is seamless. Rocks are drawn instanced around the camera and get colliders within 40 m of the player.
- **Standing still** holds position on any slope. Previously the controller turned the small push into the ground into a slow slide downhill. As in Milestone 2, slopes over 50° can't be walked up, and only slopes over 70° make the body slide; the Moon has none that steep.

### Camera, lighting, mining

- **Camera.** Third person, first person and the menu shot work in the local frame, with the horizon kept level and the camera kept above the ground.
- **Light.** The sun and earthshine are fixed in space.
  - The sky fill follows the local vertical and dims at night.
  - The sun's shadow map follows the player, sized for the local sun height, and pauses while the sun is down.
  - The helmet lamp comes on by itself as the sun sets at the astronaut.
- **Mining.** Milestone 3's deposits are placed on the Moon through the chart, keeping their ids, heights and orientation. Aiming, reach, mining effects and particle gravity all use the local vertical.
- **HUD.** It shows the province underfoot, its side of the Moon and live coordinates. Latitude and longitude are fixed so that the landing point is at 0.67°N 23.47°E, as its label always said.

### Saves

Save version 4 stores the astronaut's world position and heading. Versions 1–3 migrate: a flat-map position is carried onto the Moon through the chart, at the same spot, height above the ground and heading. Deposit ids are unchanged, so mined-out sites carry over.

## Verification

All automated. They ran on this machine, partly on battery power, in headless Chrome at 1600×900.

| Suite | Result |
| --- | --- |
| Planet sampler (continuity, landing site exactness, province distinctness, far side) | 16/16 |
| Terrain chunks (seams across faces and detail levels, exact cover, culling never hides visible ground) | 10/10 |
| Planetary physics, including one full walk around the Moon (22 km) | 15/15 |
| Milestone 1 world, Milestone 2 motor, Milestone 3 mining (Node) | all pass (M3: 22/22) |
| Browser: Moon streaming, every province on the ground, 3 km flight | 18/18 |
| Browser: play-through from the menu, far side, save and continue (dev and production) | 15/15 each |
| Browser: Milestone 1 flow (dev and production) | 21/21 each |
| Browser: Milestone 2 gameplay (dev and production) | 34/34 each |
| Browser: Milestone 3 mining (dev and production) | 51/51 each |
| Leak check: 8 mining sessions (production) | no GPU resources, listeners or heap pile up, apart from the bounded terrain cache |

Measured on this machine:
- **Frame rate.** 120 fps with vsync while playing, p99 frame time 9–10 ms, and no frame over 25 ms while streaming during a 3 km flight at 60 m/s.
- **Start-up and streaming.** The menu appears about 3.5 s after loading. A fresh view's detail settles in 0.1–0.7 s.

## Trying it

`npm run dev`, then open http://localhost:5173. New Game starts at the landing site, as before.

Things worth checking:

- **Distance.** Walk or sprint in any direction from the landing site: the horizon is close and curved, and there is no edge.
- **The far side.** Most of it is in night, so use the helmet lamp. The far side has more craters, brighter highlands, the Aitken Basin and terraced anomalies.
- **Varied ground.** Mountains, rilles, crater fields, maria and mineral provinces, each with its own look and rockiness.
- **Mining.** Mine at the landing site in both camera modes, as in Milestone 3.
- **Saves.** Save anywhere on the Moon (Esc, then Main Menu), reload, and Continue. An older save loads on the landing site where it was.

Moving around fast, in the browser console:

```js
__lunarDebug.provinces()              // every place: name, kind, near or far side
__lunarDebug.goTo('Aitken Basin')     // by name, or by kind: goTo('mountains'), goTo('anomaly')
__lunarDebug.goTo('Landing Site')     // back home
__lunarDebug.teleport(40, -25)        // a point on the landing-site map (x east, z south, meters)
```

## Known limitations

- **Coverage.** Deposits exist only around the landing site until phase 5, and exploration, discoveries and caves are still to come.
- **Arrival banner.** The "Entering region" card shows only on arrival; province-change banners are part of phase 6.
- **Chunk borders.** A very faint straight crease can show along chunk borders in close-up views: border vertices stay on the border line so detail levels meet without gaps.
- **The sky from high up.** Sky objects (Earth, sun, stars) follow the camera at fixed distances, which is correct from anywhere a player can stand. From debug views several kilometers up, Earth can show in front of the Moon.
- **Slopes between 50° and 70°.** You can stand on them but not walk up them (Milestone 2's rule). The Moon's steepest ground is about 56–61°, so this is rare.
