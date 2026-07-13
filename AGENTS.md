# AGENTS.md

## Quick facts
- Node.js >= 18, ES modules (`"type": "module"` in package.json).
- Rust toolchain required for parity harness (cargo 1.96+).
- No build step, no linter, no typechecker, no CI.
- Dependencies installed once via `npm install`. Launcher scripts auto-install if `node_modules` is missing.

## Entry points — four launchers, four UIs, one Game

| Launcher | Entry | UI | Notes |
|---|---|---|---|
| `./sandboxed [seed]` | `src/main.js` | `BlessedGameUI` + `WorldGenConfigUI` | Default UI. Shows a world-gen config menu before play. |
| `./sandboxed-blessed [seed]` | `src/main-blessed.js` | `BlessedGameUI` | Direct blessed UI, no config menu. |
| `./sandboxed-ink [seed]` | `src/main-ink.js` | `InkGameUI` | Parallel Ink-based TUI (also 24-row illuminated-manuscript theme). |
| `./sandboxed-roguelike [seed]` | `src/main-roguelike.js` | `RoguelikeUI` | CDDA-style map view. |
| `npm start` | `src/main.js` | `BlessedGameUI` | Same as `./sandboxed`. |

Seed is optional and falls back to `Date.now()` (CLI fallback is whitelisted).
Launcher scripts `cd` into their own dir before running, so they work from
anywhere.

## TUI — the Blessed UI ("Illuminated Codex")

`src/ui/BlessedGameUI.js` is the primary terminal UI. It runs on a 24×24
contrib grid in terminals ≥100×28 and falls back to a compact 12×18 layout
on smaller terminals (detected via `process.stdout.columns/rows` at
construction time). The aesthetic is "illuminated manuscript" — parchment
palette (`#f0dcb0` family), antique gold (`#d4a017` / `#f5c542`), oxblood
(`#5a0f1a` / `#7b1e2a`), gothic glyphs (`⚜ ✦ ☩ ❀ ⚔ ☥ ♕ ◈`), round
box-drawing borders, and a 200-message scrollback in the chronicle panel.

### Layout (24×24 full mode)

```
Row 0      │ Header (player, age, occupation, season, time, day, hour)
Row 1–10   │ World Map (cols 0–13)        │ Location & Nearby (cols 14–23)
Row 11–13  │ Status (cols 0–7)            │ Vitals Trend (cols 8–15)   │ Factions (cols 16–23)
Row 14–16  │ Skills (cols 0–7)            │ Inventory (cols 8–15)      │ Equipment (cols 16–23)
Row 17–18  │ Quick Actions hint bar (full width)
Row 19–20  │ Command input (2 rows, full width)
Row 21     │ Chronicle / message log (200-line scrollback)
Row 22–23  │ reserved for overlays
```

Map shows a 14-wide × 10-tall biome-glyph view centered on the player
(`,` grass, `T` forest, `~` water, `^` mountain, `.` desert, `#`
settlement, `@` player). Vitals Trend renders 5 stacked `▁▂▃▄▅▆▇█`
sparklines (Health / Feed / Drink / Rest / Energy) sampled each second.
Factions lists the top 5 factions by member count.

### Keyboard

| Key | Action |
|---|---|
| `?` or `F1` | Toggle help overlay |
| `Tab` / `Shift+Tab` | Cycle focus between panels (bright gold border on focused) |
| `↑` / `↓` | Recall command history (in input) |
| `Tab` in input | Autocomplete from registered commands |
| `Esc` | Dismiss overlay / quit |
| `q` / `Ctrl-C` | Quit |
| `W` `S` `E` `L` `M` `I` `C` `F` | Single-letter quick actions (work, sleep, eat, look, move, inventory, status, faction) |

All ~100 command handlers from the previous version are preserved
(`start`, `move n/s/e/w`, `work`, `sleep`, `eat`, `talk`, `propose`,
`craft`, `gather`, `warfare`, `study`, `prayer`, `mount`, `elect`,
`dynasty`, etc.). See `Gameplay-guide.md` and `showHelp()` for the full
list. Tab cycling + single-key shortcuts both work regardless of focus.

### Polished welcome + character creation

Before `start`, the panels show placeholder text under the ASCII title
banner (`⚜  M E D I E V A L   L I F E  ⚜ — A Chronicle of an Age`).
Typing `start` (or pressing Enter) begins the character creation wizard
inline in the welcome panel.

### Death / heir picker

When `player.alive === false`, an overlay centered on screen lists
eligible heirs from `kinship.getEligibleHeirs(player.id)`. Selection via
arrow keys + Enter (or the index number) calls `game.continueAsHeir(idx)`.

### Live updates

`start()` schedules `setInterval(() => _liveTick(), 1000)`. Each tick
samples the player's needs/health, pushes to a 40-element circular buffer,
and re-renders the map / sparklines / factions / status. The world keeps
turning via `npcCoordinator.tick` even when no command is entered.

### Compact mode

When `process.stdout.columns < 100` or `process.stdout.rows < 28`,
`BlessedGameUI._setupCompactUI()` swaps to a 12×18 layout: header /
map+location / status+factions / inventory+skills / chronicle / quick
actions / command. Sparklines and equipment panels are hidden. The same
command set and key bindings work.

### Shared theme

`src/ui/theme.js` exports palette (`C`), glyphs (`G`), border names
(`BORDERS`), biome → glyph/color map (`BIOME`), item category colors
(`ITEM_CATEGORY`), slot glyphs (`SLOT_GLYPH`), the `bar()` ASCII helper,
the welcome-screen art, and a `formatGameTime(turn)` helper. The Ink UI
uses `src/ui/ink/theme.js` independently — both share the same aesthetic
without runtime coupling.

### Headless tests

Tests use `tests/_helpers.js` → `makeHeadlessUI()` which returns a fake
UI instance. `BlessedGameUI` is **not** required by tests; it is
constructed only at runtime by the launchers. This keeps `npm test`
deterministic and TTY-free.

## Architecture (src/)
- `core/SimulationKernel.js` — turn-based engine: entity Map, `SeededRNG`,
  `WorldTime`, fidelity tiers (`activeTier` / `regionalTier` /
  `distantTier`), priority event queue. Deterministic from seed.
  `SimulationKernel.requiresSeed = true` throws if no seed provided.
- `core/SystemRegistry.js` — single source of truth for which systems get
  wired into a Game. New systems register here in dependency order.
- `world/WorldGenerator.js` — procedural world.
- `character/` — `Person`, `Needs`, `Physiology`, `Inventory`,
  `NPCCoordinator` (autonomous NPC tick).
- `systems/` — 40+ self-contained domain modules (Combat, Crafting,
  Marriage, Trading, NaturalWorld, Flora, Fauna, Agriculture, Buildings,
  Settlements, Infrastructure, Reputation, Status, NPCScheduling,
  Religion, Communication, Relationships, Household, Kinship, Economy,
  Factions, Politics, Warfare, Credit, Law, Pathogens, Treatment,
  Disability, Culture, Language, Technology, Education, Knowledge,
  Ecology, FoodWeb, FoodSystem, Physics, MaterialPhysics, Production,
  Markets, TimeManagement, ProceduralPipeline, Titles, Magic,
  Transportation). Each is a class registered in `SystemRegistry`.
- `ui/` — `BlessedGameUI`, `InkGameUI` (+ `ui/ink/` subdir), `RoguelikeUI`,
  `EnhancedGameUI`, `WorldGenConfigUI`, `theme.js` (shared), legacy `GameUI`.

`Game.js` constructor: `new Game(seed, worldConfig?, options?)`. Options:
`{ autoFeed: false }` to disable hunger auto-feed (hardcore mode).

## Default world config
`{ width:100, height:100, settlements:5, resources:50, rivers:5,
populationMin:50, populationMax:500 }`. For dev, shrink via
`{ width:50, height:50, settlements:2, populationMax:50 }`.

## Tests
- `tests/` has **20 unit tests** + **3 integration tests** + **3 parity
  tests** (108 total in `npm test`; 14 more in `cargo test` under
  `crates/sim/`).
- `npm test` runs `node --test "tests/*.test.js"` and exits non-zero if
  any test fails. This is the source of truth — DO NOT trust root-level
  scripts like `test.js` over `npm test`.
- `tests/_helpers.js` exports `makeGame`, `makeGameWithPlayer`,
  `installMathRandomSpy`, `getMathRandomSites`, `makeHeadlessUI`,
  `exerciseCommands` — use these instead of constructing Game directly.
- `npm run determinism-audit` enforces zero unwhitelisted `Math.random()`
  / `Date.now()` call sites in `src/`.
- `npm run parity` runs the Node ↔ Rust determinism oracle under
  `crates/sim/`. Currently **byte-identical** across 2000 ticks at
  128 entities for the narrow scenario in `parity/oracle.mjs`. To
  expand the parity surface, add scenarios to `crates/sim/src/parity.rs`
  and matching entries to `parity/oracle.mjs`.

## Rust port — Year 1 Foundation (Stream 1)

`crates/sim/` is the Rust port of `src/core/SimulationKernel.js`. Year 1
of the eight-year roadmap calls for proving the Rust port can match
Node determinism across 100 seeds × 10⁶ ticks; this crate lays the
foundation with the kernel primitives and a byte-identical parity
harness.

Modules:
- `rng.rs` — Mulberry32 PRNG (bit-identical to Node `Math.imul`-based
  xorshift). Verified against Node output for seed=12345.
- `worldtime.rs` — `WorldTime` with year/day/hour/minute wrap semantics
  matching Node exactly.
- `event_queue.rs` — Min-heap `PriorityQueue`. The dequeue algorithm
  mirrors Node's `items.pop() + items[0] = last` pattern (NOT
  `Vec::remove(0)`, which would shift indices). Tie-break behavior
  matches Node's verified output.
- `spatial.rs` — `SpatialIndex` with the same 21-bit cell-key packing
  as Node, including Node's 32-bit `<<` truncation that effectively
  discards high bits of `cy`.
- `kernel.rs` — `SimulationKernel` with `createEntity`, `removeEntity`,
  `scheduleIn`, `tick` (1 in-game minute per call), `processScheduled`,
  event-log cap at 4096, and a `snapshot()` for parity diffing.
- `parity.rs` — `run(ParityInput)` emits the JSON the Node oracle
  produces, so a structural diff against the Node output verifies
  byte-equivalence.

Binaries (in `crates/sim/src/bin/`):
- `oracle.rs` — emits the Rust-side parity JSON.
- `parity_check.rs` — spawns both Node and Rust oracles, structurally
  diffs their JSON, prints `parity-check: OK` or a list of diffs.

## Determinism invariant
- All RNG goes through `this.kernel.random()` (or `this.kernel.rng.next()`).
- All in-game timestamps use `this.kernel.turn`. Wall-clock is only for
  save-file names (`new Date().toISOString()`) and CLI seed fallbacks
  (whitelisted explicitly with `// AUDIT-WHITELIST: <reason>`).
- All system classes that touch RNG take `(kernel, game)` and store
  `this.kernel`.

## Saves
- Save files are JSON written to `./saves/`, named
  `save_<PlayerName>_<ISOtimestamp>.json`.
- `Game.save()` returns a plain object; persistence is the UI's job.
- Schema version is `SAVE_SCHEMA_VERSION = 2` (in `Game.js`). Older saves
  load best-effort with a console warning.

## Conventions worth knowing
- Console output during world generation is part of UX (emoji-laden
  progress lines in `Game.js` constructor and `populateWorld`).
  Suppressing stdout breaks the player-facing startup flow.
- `Game.populateWorld` only adds ~1 household per 5 people.
- `Person` IDs are issued via `kernel.nextEntityId++`; never invent IDs.
- Skill trees are nested
  (`person.skills.crafting.woodwork`, `person.skills.combat.melee`).
- Many systems take `(kernel, game)`. Preserve that wiring when adding
  systems; register new instances in `src/core/SystemRegistry.js` and
  call them from `advanceTurns` if they need a per-tick hook.
- NPC autonomous behavior (need satisfaction, occupation work, social
  interaction, bandit ambush) lives in `src/character/NPCCoordinator.js`
  — `Game.js` calls `npcCoordinator.tick()` once per in-game hour.

## Docs worth reading before big changes
- `FEATURE-DESIGN.md` — intended scope.
- `GAMEPLAY-GUIDE.md` — player-facing command reference.
- `docs/GDD_GAP_ANALYSIS.md` — what's stubbed vs. implemented.
- `docs/REPRODUCIBILITY.md` — how to run a seeded reproducible simulation.
- `CHANGELOG.md` — recent changes by version.