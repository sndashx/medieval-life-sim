# Medieval Life Simulation

> A medieval life simulator with naturalistic physics, emergent gameplay,
> and ~45 interlocked domain systems (combat, marriage, economy, warfare,
> magic, religion, kinship, factions, ecology, ...). Born, live, die, leave
> an heir. Runs entirely in your terminal.

[![tests](https://img.shields.io/badge/tests-108%20passing-brightgreen)](#)
[![determinism](https://img.shields.io/badge/determinism-audited-blue)](#)
[![rust parity](https://img.shields.io/badge/rust%20%E2%86%94%20node-byte%20identical-orange)](#crates)

---

## What is this?

You spawn into a procedurally-generated medieval world. People around you
marry, work, farm, fight, worship, scheme, and die. Time passes — hunger,
thirst, fatigue, and aging are continuous, not abstract.

A simulation tick is **one in-game minute**. Each tick the simulation:

1. Runs all scheduled events (deaths, births, marriages, raids, ...).
2. Updates the active tier of entities (where you are).
3. Updates the regional tier (settlements you're not in).
4. Updates the distant tier (statistical aggregates only).
5. Advances the world clock by one minute.

A full human life takes ~33,000,000 ticks. The simulator runs them at
real-time speed without crashing or drifting, deterministically from a
seed.

## Quick start

```bash
# 1. install
git clone https://github.com/sndashx/medieval-life-sim.git
cd medieval-life-sim
npm install

# 2. play (default Blessed UI; pass a seed for reproducibility)
./sandboxed           # random seed
./sandboxed 12345     # reproducible run

# 3. create your character (in-game)
# > start
# > Tester
# > male
```

The TUI runs on a 24×24 panel grid in terminals ≥100×28 and falls back to
a compact 12×18 layout on smaller terminals.

## Four UIs, one Game

| Launcher | UI | Theme |
|---|---|---|
| `./sandboxed [seed]` | Blessed (default) | Illuminated manuscript |
| `./sandboxed-blessed [seed]` | Blessed | Illuminated manuscript |
| `./sandboxed-ink [seed]` | Ink (React for CLI) | Parallel TUI |
| `./sandboxed-roguelike [seed]` | Roguelike | CDDA-style map view |

## 45 domain systems

`combat` · `crafting` · `relationships` · `kinship` · `economy` ·
`marriage` · `trading` · `naturalWorld` · `flora` · `fauna` ·
`agriculture` · `buildings` · `settlements` · `infrastructure` ·
`reputation` · `status` · `npcScheduling` · `culture` · `religion` ·
`communication` · `landOwnership` · `factions` · `politics` · `warfare` ·
`physics` · `materialPhysics` · `credit` · `law` · `pathogens` ·
`treatment` · `disability` · `language` · `knowledge` · `technology` ·
`education` · `ecology` · `foodWeb` · `foodSystem` · `production` ·
`markets` · `timeManagement` · `proceduralPipeline` · `titles` ·
`magic` · `transportation`

All wired into a single deterministic kernel — see
[`src/core/SimulationKernel.js`](src/core/SimulationKernel.js) and
[`src/core/SystemRegistry.js`](src/core/SystemRegistry.js).

## Rust port — Year 1 Foundation (in progress)

A Rust port of the simulation kernel is underway under
[`crates/sim/`](crates/sim/) as the first concrete step of the
[eight-year roadmap](.kilo/plans/1783864373513-tauri-rust-eight-year-roadmap.md).

The current parity harness proves the Rust port is **byte-identical** to
the Node implementation:

```text
parity-check: OK  (Node ↔ Rust byte-identical across 2000 ticks,
                   seed=1, entities=128, heartbeat_every=11)
```

Verified invariants:

- Mulberry32 RNG matches Node's `Math.imul`-based xorshift bit-for-bit.
- WorldTime wrap semantics identical.
- PriorityQueue tie-break matches Node's verified output.
- SpatialIndex 21-bit cell-key packing matches Node, including Node's
  32-bit `<<` truncation quirk (preserved verbatim so parity holds).
- Event id formula: `kernel.turn * 100000 + counter & 0xFFFF`.
- Event log capped at 4096, FIFO.

Run the parity check:

```bash
npm run parity             # default scenario (200 ticks, 8 entities)
npm run cargo:test         # 14 Rust unit tests
SEED=1 ENTITIES=128 TICKS=2000 HBEVERY=11 cargo run \
  --quiet --bin parity-check --manifest-path crates/sim/Cargo.toml
```

## Tests

```bash
npm test                    # 108 tests (parity + integration + unit)
npm run determinism-audit   # zero unwhitelisted Math.random / Date.now
npm run cargo:test          # 14 Rust unit tests
npm run parity              # Node ↔ Rust byte-identical oracle
```

## Architecture

```
medieval-life-sim/
├── src/
│   ├── core/
│   │   ├── SimulationKernel.js   — turn-based engine (entity Map, SeededRNG,
│   │   │                          WorldTime, PriorityQueue, SpatialIndex,
│   │   │                          fidelity tiers active/regional/distant)
│   │   ├── SystemRegistry.js     — single source of truth for which
│   │   │                          systems get wired into a Game
│   │   └── GameQuery.js
│   ├── character/                — Person, Needs, Physiology, Inventory,
│   │                              NPCCoordinator (autonomous NPC tick)
│   ├── systems/                  — 45 self-contained domain modules
│   ├── world/WorldGenerator.js   — procedural world
│   ├── ui/                       — Blessed, Ink, Roguelike, Enhanced, theme
│   └── Game.js                   — entry point (constructor + advanceTurns)
├── crates/sim/                   — Rust port (Year 1 of 8-year roadmap)
├── parity/                       — Node ↔ Rust determinism oracle
├── tests/                        — 108 tests, all passing
├── data/                         — name pools, scenario seeds, language data
└── scripts/audit-determinism.js  — enforces zero unwhitelisted Math.random
```

## Roadmap

We're on the first year of an eight-year plan to ship a desktop native
binary (Tauri + WebGPU + Rust simulation) to Steam and research labs.
The full plan is in
[`.kilo/plans/1783864373513-tauri-rust-eight-year-roadmap.md`](.kilo/plans/1783864373513-tauri-rust-eight-year-roadmap.md).

| Year | Theme | Status |
|---|---|---|
| 1 | Rust kernel + determinism oracle | **in progress** (parity proven) |
| 2 | Prototype end-to-end on one platform | not started |
| 3 | Engine depth (R-tree, particles, portraits) | not started |
| 4 | Steam Early Access | not started |
| 5 | Steam 1.0 (4 scenarios, 6 languages) | not started |
| 6 | Market leadership | not started |
| 7 | Research lab tier | not started |
| 8 | Long-tail sustainability | not started |

## Documentation

- [`AGENTS.md`](AGENTS.md) — agent brief, entry points, test conventions
- [`GAMEPLAY-GUIDE.md`](GAMEPLAY-GUIDE.md) — player-facing command reference
- [`FEATURE-DESIGN.md`](FEATURE-DESIGN.md) — intended scope
- [`CHANGELOG.md`](CHANGELOG.md) — version history
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute

## License

MIT. See [`LICENSE`](LICENSE).