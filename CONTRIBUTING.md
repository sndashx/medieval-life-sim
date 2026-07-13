# Contributing

Thanks for considering a contribution to Medieval Life Sim. This project
is a single-developer academic sandbox and a player-facing roguelike; both
paths are welcome.

## Ground rules

1. **Determinism is sacred.** Any new code path that affects the
   simulation must not call `Math.random()` or `Date.now()` directly. Use
   `this.kernel.random()` (which delegates to `kernel.rng.next()`) and
   `this.kernel.turn` respectively. If you need to add a CLI seed
   fallback, append `// AUDIT-WHITELIST: <reason>` to the line so the
   audit script allows it.
2. **Run the audit before committing.** `npm run determinism-audit`
   must exit 0. `npm test` must pass (105 tests).
3. **No new dependencies without `package-lock.json` updates.** We pin
   the dependency graph for reproducibility.
4. **ES modules strict.** No CommonJS, no `require()`.
5. **Match existing patterns.** System constructors take
   `(kernel, game)`. Use `registerSystems()` to add new systems to the
   game, not the inline constructor block.

## Development workflow

```bash
git clone <repo>
cd medieval-life-sim
npm install
npm test                # 105 tests should pass
npm run determinism-audit   # should report 0 unwhitelisted sites
./sandboxed 42          # blessed UI with seed 42
./sandboxed-roguelike 42
```

## Adding a new system

1. Create `src/systems/MySystem.js` with constructor `(kernel, game)`.
2. Store `this.kernel = kernel` and `this.game = game`.
3. Use `this.kernel.random()` and `this.kernel.turn` everywhere.
4. Register it in `src/core/SystemRegistry.js` (in dependency order).
5. Update tests; aim to add at least one unit test in `tests/`.

## Reporting bugs

Use GitHub issues. Include the seed, worldConfig, and a `Game.save()` JSON
if the bug is reproducible.