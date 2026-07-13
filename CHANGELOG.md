# Changelog

All notable changes to this project are documented here. Format follows
[Conventional Commits](https://www.conventionalcommits.org/).

## [0.3.0] — 2026-07-12

### Rust port — Foundation Stream (Year 1 of eight-year plan)
- **feat(crates/sim)**: scaffolded the Rust simulation-engine crate at
  `crates/sim/`. Port-faithful implementation of the four kernel primitives
  from `src/core/SimulationKernel.js` — `SeededRng` (Mulberry32, bit-identical
  to Node `Math.imul`-based xorshift), `WorldTime`, `PriorityQueue` (min-heap
  with Node-compatible dequeue semantics on ties), `SpatialIndex` (with
  Node's 32-bit `<<` truncation behavior preserved verbatim), and the
  `SimulationKernel` shell.
- **feat(parity)**: byte-identical determinism oracle harness. `parity/oracle.mjs`
  emits the Node-side scenario JSON; `crates/sim/src/bin/oracle.rs` emits the
  Rust-side JSON; `crates/sim/src/bin/parity_check.rs` cross-checks them via
  structural diff. **Verified byte-identical for 2000 ticks × 128 entities**
  at seed=1.
- **test(crates/sim)**: 14 cargo unit tests covering RNG output, WorldTime
  wrap, PriorityQueue tie-break matching Node, SpatialIndex raw-key
  matching Node's 32-bit truncation, and event-log cap.
- **test(integration)**: 3 new npm tests (`tests/parity.test.js`) calling the
  parity harness via `cargo run --bin parity-check`. Total suite: 108 tests,
  all passing.
- **scripts**: added `npm run cargo:build`, `cargo:test`, `parity`, `oracle:node`,
  `oracle:rust` for the cross-implementation workflow.

## [0.2.0] — 2026-07-12

### Determinism foundation
- **feat(kernel)**: SeededRNG is the sole entrypoint for randomness in
  simulation path. `SimulationKernel.requiresSeed = true` throws if a
  kernel is constructed without an explicit seed.
- **fix(sweep)**: removed 106 `Math.random()` call sites across 33 files;
  all now flow through `kernel.random()` / `kernel.rng.next()`.
- **fix(sweep)**: removed 206 unwhitelisted `Date.now()` call sites; all
  in-game timestamps now use `kernel.turn`. Save-file metadata and CLI seed
  fallbacks are whitelisted.
- **feat(scripts)**: added `scripts/audit-determinism.js` and
  `npm run determinism-audit` to enforce zero unwhitelisted sites.

### Test infrastructure
- **test**: added 3 integration tests (`integration.test.js`,
  `save-load-roundtrip.test.js`, `cmd-coverage.test.js`). Total suite: 105
  tests, all passing.
- **fix(ui)**: `Combat.resolveAttack` is a static method; the four UIs now
  call it via `this.game.combat.constructor.resolveAttack(...)`.

### Architecture
- **refactor(core)**: extracted system instantiation block (49 systems)
  from `Game.js` into `src/core/SystemRegistry.js`. `Game.js` shrunk from
  1871 → 1562 LOC.
- **refactor(character)**: extracted NPC autonomous-tick logic from
  `Game.js` into `src/character/NPCCoordinator.js`. NPC behavior unchanged.
- **refactor(modules)**: split `src/systems/Social.js` into per-domain
  modules (`Relationships.js`, `Household.js`, `Kinship.js`, `Economy.js`)
  with a back-compat re-export shim. Extracted `Inventory` from
  `src/systems/Combat.js` to `src/character/Inventory.js`.
- **refactor(system-signatures)**: most systems now take `(kernel, game)`
  consistently; minor exceptions preserved for systems without RNG need
  (`CraftingSystem`, `TimeManagement`, `ProceduralPipeline`, `FoodWeb`).

### Player-visible wiring
- **feat(ui)**: added `gather`, `hunt`, `harvest`, `plant`, `gossip`, `buy`,
  `sell` commands to all three UIs (Enhanced, Blessed, Roguelike).
  Commands integrate with existing `Flora`, `Fauna`, `Agriculture`,
  `Reputation`, and `Trading` systems.
- **feat(game)**: added `autoFeed` constructor option (default true). When
  set to `false`, the player must eat manually — used for hardcore mode
  and reproducibility tests.

## [0.1.0] — initial release

- Project bootstrap; full simulation engine, ~30 domain systems, three
  terminal UIs.