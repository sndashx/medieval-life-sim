# Reproducibility

This project is designed so that any simulation run can be reproduced
bit-identically from its seed. The pattern matters for academic reuse,
deterministic regression testing, and community bug reports.

## Prerequisites

- Node.js >= 18.0.0 (matches `package.json` engines).
- npm dependencies installed: `npm ci` (uses `package-lock.json`).

## How to run a reproducible simulation

```bash
git clone <repo>
cd medieval-life-sim
npm ci
./sandboxed 42        # seed = 42, blessed UI
./sandboxed-blessed 42
./sandboxed-roguelike 42
```

Every command-line launcher accepts an optional seed as the first
positional argument. When you omit it, the launcher falls back to
`Date.now()` (deterministic only if you record the wall-clock value).

## What is deterministic

| Source of randomness | How it's handled |
|---|---|
| `Math.random()` in `src/` | Replaced by `kernel.random()` (which delegates to `kernel.rng.next()`, a Mulberry32 PRNG seeded from `seed`). |
| `Date.now()` in `src/` simulation path | Replaced by `kernel.turn` (an integer counter that increments on every kernel tick). |
| CLI seed fallback (`main.js`, `main-ink.js`) | Whitelisted as `// AUDIT-WHITELIST: cli seed fallback`. |
| `SimulationKernel.requiresSeed` mode | Set `SimulationKernel.requiresSeed = true` to throw instead of falling back. |
| Save-file names | Use `new Date().toISOString()` (whitelisted; not part of simulation state). |

## Auditing determinism

Run `npm run determinism-audit` to scan `src/` for any unwhitelisted
`Math.random()` or `Date.now()`. A clean run prints:

```
Determinism audit
=================
Scanned:    /path/to/src
Math.random: 0 unwhitelisted
Date.now:    0 unwhitelisted
Total:       0
OK — all call sites are whitelisted.
```

If you add a new whitelisted site (e.g. a CLI seed fallback), annotate
the line with `// AUDIT-WHITELIST: <reason>` so the audit script allows
it and documents why.

## Running the test suite

```bash
npm test           # 105 tests, ~10s wall time
```

`npm test` runs `node --test "tests/*.test.js"`. The suite covers:
- 20 system-specific unit tests (combat, death, marriage, religion, etc.)
- 1 determinism contract test (same seed → identical state)
- 3 new integration tests:
  - `integration.test.js` — 1000-turn determinism, intermediate checkpoints
  - `save-load-roundtrip.test.js` — save/load equivalence
  - `cmd-coverage.test.js` — every required command is recognised by the parser

## World configuration

`Game.js` accepts `(seed, worldConfig, options?)`:
- `seed` (number) — RNG seed; required for reproducible runs.
- `worldConfig` (object) — `{ worldSize, settlements, resources, rivers,
  populationMin, populationMax }`. Smaller configs (e.g.
  `{ width:30, height:30, settlements:1, populationMax:8 }`) initialize
  in <1 second and are used by `tests/_helpers.js`.
- `options.autoFeed` (bool, default true) — set false to disable the
  player's auto-feed in `advanceTurns` (hunger must be satisfied manually).

## Expected output of `npm run determinism-audit`

See the "Auditing determinism" section above. Current baseline: **0
unwhitelisted sites**.

## Replay procedure for bug reports

If you encounter a bug, capture:
1. The seed (CLI arg).
2. The `worldConfig` (if non-default).
3. A `Game.save()` JSON after reproducing the bug.
4. The `node --version` and OS.

This is enough to deterministically replay any saved state.