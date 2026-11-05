# LUNAR EXILE --- Milestones 5--8 Specification

**Project:** LUNAR EXILE\
**Document:** `SPEC.md`\
**Scope:** Economy and shop, monsters and combat, survival progression,
final polish and release\
**Prerequisite:** Milestone 4 (spherical Moon, planetary movement,
global deposits, exploration, caves and underground digging) must be
completed and verified before starting Milestone 5.

------------------------------------------------------------------------

## 1. Product vision

LUNAR EXILE is a low-poly 3D lunar exploration and survival game. Its
core loop combines the resource-collection and progression feel of *Moon
Sweepers* with original survival, monster and combat systems.

The player explores a fully spherical Moon, collects lunar dust and
minerals, sells resources for Lunar Credits (LC), purchases better
equipment, explores increasingly dangerous regions and caves, and fights
hostile creatures.

The game must retain its own implementation, assets, UI, names,
progression, world design and identity. Use other games only as
high-level gameplay inspiration; do not copy proprietary assets, code,
maps, UI layouts or distinctive content.

### Core gameplay loop

1.  Explore the Moon's surface and underground caves.
2.  Collect lunar dust, minerals and valuable discoveries.
3.  Return to a trading point or use an available trade interface.
4.  Sell resources and earn Lunar Credits.
5.  Purchase better mining tools, storage, oxygen equipment, suits and
    weapons.
6.  Explore more dangerous areas and fight hostile creatures.
7.  Unlock new equipment and capabilities, then repeat with greater
    rewards.

### Existing systems to preserve

Milestones 1--4 have established the game's foundation. Before each
milestone, inspect the current code and reuse the existing
implementations wherever possible.

Preserve: - Spherical planetary terrain, terrain streaming and LOD. -
Planetary gravity, player movement and first-/third-person cameras. -
Existing astronaut model, animations and controls. - Surface and cave
exploration, named provinces and locations. - Existing resource
deposits, mining, digging and collection. - Inventory, item definitions,
resource rarity and save migration. - Existing menus, HUD, settings,
audio and graphics options. - Deterministic world generation and stable
identifiers.

Do not rewrite working systems merely to fit this document. Adapt this
specification to the actual repository architecture and document any
necessary deviations before implementation.

------------------------------------------------------------------------

# MILESTONE 5 --- Economy, Trading, Shop and Equipment Progression

## 5.1 Objective

Turn collected resources into a meaningful economy. The player must be
able to sell gathered materials, earn Lunar Credits, purchase equipment
and feel a clear improvement in mining and exploration capability.

The economy must connect directly to the existing mining and inventory
systems.

## 5.2 Trading system

Implement a trading system using the project's established trading-point
concept. The preferred fiction is an automated trading spaceship or
lunar trading terminal.

Requirements: - Provide a discoverable, clearly marked trading location
or terminal. - Allow the player to open the trade interface when within
interaction range. - Display the player's sellable inventory. - Show
item name, quantity, unit value and total sale value. - Allow selling
one item, a selected quantity or all eligible items. - Show the Lunar
Credits earned and update the balance immediately. - Prevent selling
quest-critical, equipped or otherwise non-sellable items. - Confirm bulk
sales where accidental loss would be costly. - Handle empty inventory
and insufficient/invalid quantities safely. - Make transactions atomic:
do not remove items unless the corresponding credit transaction
succeeds. - Use server-independent local game logic; do not require an
online service for the core economy.

If the current game has no fixed trading station, propose the smallest
coherent implementation that fits its world and existing interaction
model. Do not introduce multiplayer or online trading.

## 5.3 Currency and economy data

Introduce a persistent Lunar Credits balance.

Requirements: - Use integer currency values. - Centralize item buy and
sell values in data/configuration, not scattered UI code. - Keep buy and
sell prices distinct. - Ensure every sellable resource has a defined
value or is explicitly marked unsellable. - Validate all transactions
against inventory quantities and player balance. - Prevent negative
balances, duplicated payouts, negative quantities and repeated
transaction exploits. - Use a single transaction path for all purchases
and sales. - Provide clear feedback for success, failure and
insufficient funds.

Initial balance and item prices should be configurable and play-tested
rather than hard-coded throughout the codebase.

## 5.4 Shop

Create an accessible shop interface, preferably at the trading point or
an integrated shop terminal.

Shop categories: - Mining tools and tool upgrades. - Storage and
inventory capacity upgrades. - Oxygen tanks or other survival-support
equipment. - Protective suits and suit upgrades. - Weapons, if the
weapon system is introduced in M6. - Utility equipment and exploration
upgrades.

For each item show: - Name and icon/model. - Description and gameplay
effect. - Price in Lunar Credits. - Current ownership/equipment state. -
Requirements or unlock conditions. - Purchase/equip action and clear
result feedback.

Requirements: - Buying an item deducts the correct amount exactly
once. - The player cannot buy an already-owned unique item unless it is
intentionally stackable or upgradeable. - Upgrades must have clear
levels, costs and effects. - Equipment must integrate with existing
player, mining and inventory systems. - Shop data must be configurable
and testable. - The UI must remain usable at supported desktop
resolutions.

## 5.5 Equipment and upgrades

Implement only upgrades that can be connected to real gameplay values.

Examples: - Mining power: reduces time needed to mine deposits and
diggable cave material. - Mining efficiency: improves resource yield
only if the economy can remain balanced. - Storage capacity: increases
inventory capacity. - Oxygen capacity: becomes useful with M7 survival
mechanics. - Suit protection: prepares for hostile or hazardous
regions. - Utility light: improves visibility in dark caves if not
already covered by the existing cave lamp.

Do not add upgrades that only change a displayed number without
affecting gameplay.

## 5.6 HUD and feedback

Display: - Current Lunar Credits balance. - Trade/shop interaction
prompt when relevant. - Purchase/sale confirmation. - Insufficient funds
feedback. - Relevant equipment upgrade indicators.

Avoid cluttering the existing HUD. Follow its current visual language.

## 5.7 Persistence

Save: - Lunar Credits balance. - Purchased unique items. - Upgrade
levels. - Equipped equipment. - Any shop unlock/progression state.

Requirements: - Add a safe save-version migration. - Existing saves from
M1--M4 must load without losing inventory, mined deposits, cave edits,
discoveries or player position. - Validate loaded currency and ownership
data. - Do not award credits again when reloading after a sale.

## 5.8 Milestone 5 acceptance criteria

M5 is complete only when: 1. The player can reach and use a trading
point. 2. Sellable resources can be sold for Lunar Credits. 3. Inventory
quantities and currency update correctly. 4. The shop displays available
equipment and prices. 5. Purchases and upgrades have real gameplay
effects. 6. Insufficient funds and invalid transactions are handled
safely. 7. Currency, purchases, upgrades and equipment persist after
reload. 8. Existing mining, inventory, exploration and cave
functionality still works. 9. Automated tests cover economy
calculations, transaction validation, purchases, upgrades and save
migration. 10. Browser tests verify the complete collect → sell → earn →
buy → equip loop.

------------------------------------------------------------------------

# MILESTONE 6 --- Monsters, Weapons, Enemy AI and Combat

## 6.1 Objective

Introduce hostile lifeforms that make exploration dangerous and give the
player a reason to purchase and upgrade weapons.

Combat must fit the low-poly sci-fi lunar setting and must work on the
spherical surface and inside caves.

## 6.2 Design principles

-   Monsters are original game creatures, not copies of creatures from
    another game.
-   Enemy behaviour must be readable and fair.
-   Combat should add tension without overwhelming the
    resource-collection loop.
-   Enemies must work with planetary gravity and local surface
    orientation.
-   Cave encounters should feel more dangerous than ordinary surface
    encounters.
-   Avoid spawning enemies directly on top of the player.
-   Support performance-conscious spawning and despawning.

## 6.3 Enemy types

Implement a small, polished roster before adding many variants.

Suggested initial roster:

### A. Lunar Stalker

-   Common surface enemy.
-   Patrols or wanders within a local area.
-   Detects the player within a configurable range.
-   Approaches and attacks when close.
-   Retreats or loses interest when the player escapes far enough.

### B. Cave Crawler

-   Primarily found underground.
-   Moves through cave spaces and attacks at close range.
-   Uses cave geometry and collision correctly.
-   Can ambush the player, but must provide an understandable warning.

### C. Heavy Guardian

-   Rare, stronger enemy in selected dangerous locations or deep caves.
-   Higher health and damage.
-   Slower, more telegraphed attacks.
-   May guard a valuable resource or discovery.

Names and exact behaviours are design proposals. Inspect the current art
and animation capabilities before committing to production scope. Prefer
three distinct, functional enemies over many unfinished variants.

## 6.4 Enemy AI states

Use a maintainable state machine or equivalent architecture.

Suggested states: - Idle. - Patrol/wander. - Investigate sound or
disturbance, if supported. - Detect player. - Chase. - Attack. -
Stagger/hit reaction. - Retreat or return to patrol. - Dead/despawn.

Requirements: - Configurable detection, attack and disengagement
ranges. - Clear transitions and cooldowns. - Enemies must not attack
through solid cave walls or terrain. - Use line-of-sight checks where
appropriate. - Prevent enemies from getting permanently stuck. - Ensure
navigation respects the spherical surface and cave geometry. - Limit
active AI work by distance and visibility. - Use deterministic spawn
placement where practical.

If robust navigation across arbitrary cave geometry is not feasible with
the current stack, implement a constrained local navigation solution and
clearly document its limits. Do not fake pathfinding by allowing enemies
to pass through walls.

## 6.5 Weapons

Introduce a small initial weapon set that has distinct gameplay roles.

Suggested weapons: - Mining/utility beam: existing tool; retain its
mining purpose. Do not silently turn it into an overpowered weapon. -
Pulse pistol: basic ranged weapon with moderate damage and reliable
handling. - Scatter weapon: short-range, high burst damage. - Heavy
energy weapon: expensive, powerful, slower firing or limited by
energy/ammunition.

The final roster should be selected based on the project's art, input
and performance constraints.

For every weapon define: - Purchase price. - Damage. - Range. - Fire
rate or cooldown. - Spread/accuracy where applicable. - Ammunition or
energy rules. - Reload/recharge behaviour if applicable. - Unlock
requirements. - Audio and visual feedback. - Whether it can damage each
enemy type.

Requirements: - Weapons must be purchasable through the M5 shop. -
Weapon switching must be clear and responsive. - Prevent firing during
invalid states, menus or pause. - Respect first-person and third-person
camera modes. - Use raycasts/projectiles appropriate to the weapon. -
Validate hits against world geometry and enemy targets. - Avoid damaging
enemies through solid terrain or cave walls. - Provide hit feedback
without excessive screen shake or visual clutter.

## 6.6 Player combat and damage

Implement: - Player health. - Enemy attack damage. - Hit feedback. -
Death/defeat handling. - A fair recovery or respawn flow. - Temporary
invulnerability after taking damage only if needed to prevent
unavoidable repeated hits.

Do not add complex gore. Keep the presentation suitable for the game's
stylized sci-fi tone.

The exact defeat penalty must be designed and documented before
implementation. Avoid deleting the player's entire inventory or progress
on death. A reasonable first version is a recoverable respawn with a
modest, configurable penalty.

## 6.7 Enemy drops and rewards

-   Enemies may drop configurable resources or credits.
-   Drops must have stable identifiers and integrate with existing
    collection and inventory rules.
-   Prevent duplicate rewards on repeated death events or save/load.
-   Avoid making combat the only profitable way to earn currency.
-   Balance enemy rewards against resource selling prices.

## 6.8 Spawn distribution

-   Surface enemies should spawn in appropriate provinces and locations.
-   Cave enemies should be more common in selected caves or deeper
    chambers.
-   Dangerous regions may have higher enemy density or stronger enemy
    variants.
-   Do not spawn enemies inside walls, under the terrain or in
    inaccessible geometry.
-   Use deterministic placement where possible, while allowing
    controlled variation in patrol behaviour.
-   Keep spawn density and active enemy counts configurable by
    graphics/performance settings where appropriate.

## 6.9 Audio and visual feedback

Provide original or properly licensed: - Enemy idle, movement and attack
sounds. - Weapon firing and impact sounds. - Enemy damage and defeat
sounds. - Muzzle/beam effects, projectiles and impact effects. - Clear
attack telegraphs.

Reuse existing audio/effects infrastructure. Avoid expensive real-time
effects that compromise browser performance.

## 6.10 Persistence

Persist only the state needed for a coherent experience: - Player health
or a safe respawn state. - Owned and equipped weapons. -
Ammunition/energy if used. - Persistent enemy/world changes only if
required by the design. - Collected enemy drops and unique rewards.

Do not save every transient AI frame or patrol position. Regenerate
ordinary enemies from deterministic spawn data unless a specific
encounter needs persistent state.

Add a safe save migration and validate all loaded combat state.

## 6.11 Milestone 6 acceptance criteria

M6 is complete only when: 1. At least three distinct enemy archetypes
are functional, or a documented smaller scope is approved. 2. Enemies
can spawn on the spherical surface and in caves. 3. Enemy AI can detect,
chase, attack and disengage appropriately. 4. Enemies respect terrain
and cave collision. 5. At least two purchasable weapons have distinct,
functional behaviour. 6. Weapon switching, firing, hit detection and
cooldowns work in both camera modes. 7. Player health, damage and
defeat/recovery work. 8. Rewards cannot be duplicated through reloads or
repeated events. 9. Combat state and owned equipment persist safely. 10.
Automated and browser tests cover AI state transitions, hit detection,
collision, damage, rewards and save/load. 11. Existing mining and
economy loops remain intact.

------------------------------------------------------------------------

# MILESTONE 7 --- Survival, Progression and Dangerous Regions

## 7.1 Objective

Make the Moon feel like a hostile place that requires preparation. Add
survival systems that create meaningful decisions and connect
exploration, economy, equipment, caves and combat.

Do not add survival meters simply for decoration. Every meter must have
understandable consequences, counterplay and a way to recover.

## 7.2 Survival systems

### Oxygen

-   Oxygen is a configurable resource.
-   It may drain in designated hazardous areas, deep caves or other
    explicitly defined conditions.
-   Safe areas or suitable equipment should reduce or stop oxygen drain.
-   Oxygen tanks purchased in M5 extend available time or provide
    replenishment.
-   Give clear low-oxygen warnings.
-   Never drain oxygen unexpectedly in the ordinary starting area.
-   On depletion, trigger a clear, fair consequence and recovery flow.
-   Avoid forcing the player to return to a shop every few minutes.

### Suit integrity / protection

-   Suit integrity may be damaged by enemy attacks or environmental
    hazards.
-   Protection upgrades reduce appropriate incoming damage.
-   Repair should be possible through a shop, repair station or defined
    consumable.
-   Clearly communicate current integrity and repair cost.
-   Do not create overlapping health and suit systems that have no
    distinct purpose.

### Environmental hazards

Introduce a small number of readable hazards, such as: - Radiation or
anomaly zones. - Extreme cold in selected regions or deep caves. -
Unstable cave areas or environmental damage zones.

Each hazard must: - Have visible or audible warning cues. - Have clear
boundaries or understandable exposure rules. - Have a countermeasure or
equipment upgrade. - Be configurable and testable. - Avoid unavoidable
damage at spawn or during ordinary traversal.

Select only hazards that can be implemented convincingly with the
current world architecture. Do not add all proposed hazards
automatically.

## 7.3 Progression structure

Create a progression path based on exploration and equipment capability.

Possible progression: 1. Landing region: basic dust and common minerals.
2. Nearby provinces: improved resource opportunities and manageable
threats. 3. Remote regions: rarer resources, stronger enemies and
environmental hazards. 4. Cave networks: deeper mining, oxygen
preparation and stronger enemies. 5. Anomaly/ancient locations:
high-risk discoveries and valuable rewards.

Requirements: - Keep the Moon open and explorable; do not impose
arbitrary invisible level gates. - Use equipment requirements as
optional or soft gates where possible. - Communicate danger before the
player commits to a difficult area. - Reward preparation and
exploration. - Ensure early areas remain useful for returning players. -
Make progression understandable through the HUD, map, shop or discovery
UI.

## 7.4 Objectives and discoveries

Introduce a lightweight objective system to give direction without
turning the game into a linear mission campaign.

Examples: - Visit a newly discovered province. - Collect a target
quantity of a resource. - Find a cave entrance. - Reach a specified cave
depth. - Defeat a particular enemy. - Recover an alien component. -
Purchase a required upgrade.

Requirements: - Objectives must be optional unless explicitly identified
as main progression. - Track completion reliably. - Reward credits,
resources or unlocks without duplicating rewards. - Persist completed
objective state. - Avoid excessive quest markers or intrusive
notifications.

## 7.5 Map and navigation

Extend the existing exploration/province UI only as needed.

Useful information may include: - Current province and named location. -
Discovered cave mouths and major landmarks. - Trading point. - Player
location and heading. - Known dangerous regions. - Completed objectives.

Do not reveal undiscovered locations if discovery is part of the
intended experience. Keep the map readable and performant on a spherical
world.

## 7.6 Economy and combat balancing

Revisit: - Resource sell prices. - Upgrade costs. - Weapon prices. -
Enemy health and damage. - Enemy rewards. - Oxygen capacity and
consumption. - Repair costs. - Hazard severity. - Resource availability
by province and cave depth.

Prevent: - Infinite easy-credit loops. - A single best weapon
invalidating all others. - Early upgrades making the game trivial. -
Mandatory grinding. - Survival drains that interrupt exploration too
frequently. - Death penalties that erase hours of progress.

Use configurable data and record the rationale for initial balance
values.

## 7.7 Save and recovery

Persist: - Survival state needed for safe continuation. - Equipment and
upgrades. - Objective progress. - Discovered map state. - Relevant
one-time rewards and world events.

On loading, ensure the player cannot spawn in an immediately lethal
state. If a saved location is unsafe or invalid, use a documented safe
recovery position without erasing unrelated progress.

## 7.8 Milestone 7 acceptance criteria

M7 is complete only when: 1. Survival systems have clear rules and
meaningful counterplay. 2. Oxygen or other chosen resources behave
consistently in their designated areas. 3. Equipment changes survival
outcomes. 4. Hazards are readable and avoid unfair unavoidable damage.
5. Progression encourages exploration without arbitrary world
boundaries. 6. Objectives and discoveries persist without duplicate
rewards. 7. Map/navigation information is accurate and useful. 8.
Economy, upgrades, enemies and survival are balanced together. 9.
Save/load and recovery work from safe and hazardous locations. 10.
Automated tests cover survival calculations, hazard boundaries,
equipment effects, objectives, rewards and persistence. 11. The full
exploration → collect → sell → upgrade → survive → fight loop is
playable.

------------------------------------------------------------------------

# MILESTONE 8 --- Final Polish, Optimization, QA and Release Preparation

## 8.1 Objective

Turn the completed game into a stable, understandable and presentable
desktop-browser release. Focus on reliability, performance, onboarding,
accessibility, visual/audio consistency, documentation and deployment.

Do not use M8 as an excuse to add large new systems. New features must
be deferred unless they are essential to fixing a release blocker.

## 8.2 Performance

Profile the game in representative situations: - Main menu. - Landing
region. - Fast movement across the surface. - Distant terrain
streaming. - Entering and leaving caves. - Inside a large cave. - Mining
and digging. - Multiple nearby enemies. - Combat with several effects
active. - Shop and inventory UI. - Long play session.

Measure and report: - Average FPS and frame time. - 1% low FPS or an
equivalent frame-time percentile where available. - Worst frame
spikes. - Draw calls. - Active triangles/geometry where practical. -
Active terrain chunks and physics colliders. - Memory use and trends
during long sessions. - GPU resource stability.

Targets should be realistic and measured on the actual test hardware. Do
not claim a universal FPS guarantee.

Optimization priorities: - Terrain LOD, streaming and culling. - Reuse
and disposal of geometries/materials. - Instancing where appropriate. -
Pooling short-lived particles and effects. - Limit active AI and physics
work by distance. - Avoid excessive React re-renders in frame loops. -
Avoid unnecessary allocations in per-frame updates. - Keep cave
remeshing localized. - Ensure unloaded chunks release GPU and physics
resources. - Avoid loading the entire planet or every enemy
simultaneously.

Provide separate results for Low, Medium and High graphics settings
where supported.

## 8.3 Stability and regression testing

Run the complete test suite against both development and production
builds.

Regression coverage must include: - M1: menu, settings, pause, resume
and save flow. - M2: movement, jumping, sprinting, camera switching and
pointer lock. - M3: mining, collection, inventory, regrowth and
persistence. - M4: spherical terrain, chunk boundaries, planetary
movement, provinces, deposits, caves, digging and save migration. - M5:
sales, credits, shop purchases, upgrades and transaction persistence. -
M6: enemy AI, combat, weapon switching, damage, rewards and recovery. -
M7: oxygen, hazards, equipment protection, objectives and progression. -
M8: long-session stability, performance and deployment.

Requirements: - Fix genuine regressions rather than weakening tests. -
Update tests only when the expected behaviour has intentionally changed
and document why. - Separate test-environment failures from product
failures. - Do not claim tests passed unless they were executed
successfully. - Record exact test counts and failures. - Repeat flaky
tests to establish whether the issue is deterministic. - Test save
migrations from every supported previous save version. - Verify
corrupted or invalid saves fail safely without crashing the game.

## 8.4 Manual QA checklist

Perform real manual testing in a desktop browser.

### World and movement

-   Start a new game.
-   Continue an existing save.
-   Travel across multiple provinces.
-   Cross cube-sphere face boundaries.
-   Travel around the Moon and visit the far side.
-   Verify the horizon, lighting and Earth presentation.
-   Check terrain streaming and collision.
-   Switch first-person and third-person views.

### Mining and economy

-   Mine surface and cave deposits.
-   Dig cave rock.
-   Collect partial and full drops.
-   Sell resources.
-   Buy and equip upgrades.
-   Test insufficient funds.
-   Reload and verify credits, inventory and equipment.

### Combat and survival

-   Encounter each enemy type.
-   Test detection, chasing, attacks and disengagement.
-   Fire each weapon.
-   Verify hits cannot pass through solid terrain.
-   Take damage and recover.
-   Test oxygen and environmental hazards.
-   Test protective equipment and repairs.
-   Complete objectives and verify rewards.

### Save/load

-   Save in a safe surface location.
-   Save inside a cave.
-   Save after mining and digging.
-   Save after buying equipment.
-   Save after combat.
-   Continue each save and verify state.
-   Test old save migrations.

Manual QA must be reported separately from automated browser tests.

## 8.5 Visual and UX polish

Review consistency across: - Main menu and pause menu. - HUD and
reticle. - Inventory. - Shop and trading UI. - Map and discovery UI. -
Health and survival indicators. - Enemy health/attack feedback. -
Notifications and interaction prompts. - Settings and graphics options.

Requirements: - Maintain the established low-poly sci-fi visual
identity. - Ensure text is readable against all backgrounds. - Keep
important feedback visible without excessive clutter. - Make interaction
prompts consistent. - Ensure menus pause gameplay correctly. - Ensure
pointer-lock loss and focus changes are handled safely. - Respect
reduced-motion settings where implemented. - Ensure UI remains usable at
common desktop resolutions.

## 8.6 Audio polish

-   Review music, ambient sound, mining, collection, shop, weapons,
    enemies and survival warnings.
-   Balance relative volume levels.
-   Prevent repeated sounds from becoming overwhelming.
-   Respect audio settings and mute.
-   Avoid audio continuing unexpectedly after pause, death or scene
    transitions.
-   Use only original or properly licensed audio.
-   Document placeholder or temporary sounds that remain.

## 8.7 Accessibility and settings

Review: - Master/music/effects volume. - Mouse sensitivity. - Graphics
quality. - Reduced motion. - Readable UI scale where supported. - Clear
control hints. - Consistent key bindings. - Visual feedback that is not
dependent on colour alone.

Do not add settings that do not actually affect the game.

## 8.8 Deployment and release readiness

Requirements: - Production build succeeds from a clean install. - Vercel
deployment works with the repository's current configuration. -
Refreshing nested routes does not break the app. - No required
local-only assets or environment variables are missing. - No secrets are
committed. - No critical console errors or unhandled promise
rejections. - Asset paths work in production. - Loading and error states
are understandable. - README includes setup, scripts, controls,
architecture overview and known limitations. - Add or update milestone
documentation with test evidence. - Add a changelog or release notes for
the release candidate.

Do not publish a release candidate while a known data-loss,
save-corruption, progression-blocking or crash bug remains.

## 8.9 Release checklist

Before declaring M8 complete: 1. Clean install and production build
succeed. 2. Production deployment is verified. 3. Critical automated
regression suites pass. 4. Save migrations are verified. 5. Manual QA
checklist is completed or remaining items are explicitly listed. 6.
Performance measurements are recorded. 7. No known critical or
high-severity release blockers remain. 8. README and milestone
documentation are current. 9. Controls and known limitations are
documented. 10. Final release report distinguishes verified facts from
assumptions.

## 8.10 Milestone 8 acceptance criteria

M8 is complete only when: - The production build and deployment work. -
The full critical gameplay loop has passed regression testing. -
Performance is measured and acceptable on the target desktop-browser
configuration. - Long-session memory/resource behaviour has been
checked. - Manual QA has been performed and documented. - No known
critical release blockers remain. - Documentation, controls, known
issues and release notes are complete.

------------------------------------------------------------------------

# 9. Shared engineering rules for M5--M8

These rules apply to every milestone.

## 9.1 Inspect before changing

At the start of each milestone: 1. Inspect the current repository and
branch. 2. Read the current README and milestone documentation. 3.
Identify the actual current save version and architecture. 4. Locate the
existing systems that should be reused. 5. Report the proposed
file-level changes and risks. 6. Confirm the previous milestone is
stable before extending it.

Do not assume paths, APIs, data structures or save versions from this
specification. The repository is the source of truth.

## 9.2 Work in controlled phases

-   Split each milestone into small, reviewable phases.
-   Commit a known-good baseline before large changes.
-   Keep the game runnable at each meaningful checkpoint.
-   Run focused tests after each phase.
-   Run regression suites after integrating systems.
-   Provide a concise report after each phase.
-   Pause for user review at major playable checkpoints.

## 9.3 Preserve existing systems

-   Extend current stores and systems where practical.
-   Avoid duplicate inventory, currency, interaction, audio or save
    implementations.
-   Do not rewrite the terrain or planetary movement systems for
    unrelated features.
-   Keep stable IDs for existing resources, deposits, provinces,
    locations and caves.
-   Do not silently change existing gameplay behaviour.
-   Use safe, sequential save migrations.

## 9.4 Data-driven design

Keep configurable game data centralized: - Item values and shop
prices. - Upgrade costs and effects. - Weapon statistics. - Enemy
health, damage, detection and rewards. - Spawn density and region
rules. - Survival consumption and hazard values. - Objective
definitions.

Avoid scattering balance constants through components and UI code.

## 9.5 Performance and browser constraints

-   Desktop browser is the primary target.
-   Avoid unnecessary dependencies.
-   Profile before optimizing.
-   Keep per-frame work bounded.
-   Dispose of resources correctly.
-   Do not generate the entire spherical world at once.
-   Keep physics and AI work local to relevant gameplay areas.
-   Test at more than one graphics quality.
-   Do not optimize only for one powerful development machine.

## 9.6 Definition of done

A feature is not complete merely because it compiles or appears in a
screenshot.

It must: - Work in the actual game. - Integrate with existing systems. -
Handle failure and edge cases. - Persist if persistence is required. -
Have appropriate automated coverage. - Be manually verified where
browser automation cannot faithfully test it. - Be documented with
honest results and known limitations.

------------------------------------------------------------------------

# 10. Recommended milestone execution order

  -----------------------------------------------------------------------
  Milestone               Focus                   Required result before
                                                  moving on
  ----------------------- ----------------------- -----------------------
  M5                      Economy, selling, shop, Complete collect → sell
                          equipment               → buy → equip loop

  M6                      Monsters, weapons,      Functional surface and
                          combat                  cave combat

  M7                      Survival, hazards,      Meaningful preparation
                          objectives, progression and exploration loop

  M8                      Optimization, QA,       Verified release
                          polish, deployment      candidate
  -----------------------------------------------------------------------

**Do not begin M5 until M4 has passed its final regression and
performance checks.**\
**Do not begin M6 until M5's economy and shop are stable.**\
**Do not begin M7 until M6 combat is playable and tested.**\
**Do not use M8 to hide unfinished core gameplay; defer new features and
stabilize the game.**

------------------------------------------------------------------------

# 11. Final report format

At the end of each milestone, provide:

1.  **Status:** complete, partially complete or blocked.
2.  **Features delivered:** concrete player-visible behaviour.
3.  **Files/systems changed:** concise list.
4.  **Automated tests:** exact suites, counts, pass/fail and
    environment.
5.  **Manual tests:** what was actually tested by a human.
6.  **Performance:** measured values and test hardware/browser.
7.  **Save compatibility:** current version and migrations verified.
8.  **Known issues:** severity, impact and workaround.
9.  **Deferred work:** features intentionally postponed.
10. **Next step:** the next phase or milestone.

Never report a manual test as completed if it was only simulated by
headless browser automation.
