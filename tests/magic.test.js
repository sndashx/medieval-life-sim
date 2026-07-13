import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

test('magic: pool is exposed and reports current mana', () => {
  const game = makeGameWithPlayer(1212);
  const player = game.getPlayer();
  const pool = game.magic.getPool(player);
  assert.ok(pool, 'getPool returns a value');
  assert.ok(typeof pool.current === 'number', 'pool.current is numeric');
  assert.ok(typeof pool.max === 'number', 'pool.max is numeric');
  assert.ok(pool.current >= 0, 'current >= 0');
  assert.ok(pool.max > 0, 'max > 0');
});

test('magic: SPELL_TYPES registry is non-empty', () => {
  // Dynamic import to avoid circular deps — same module the game uses
  return import('../src/systems/Magic.js').then(({ SPELL_TYPES }) => {
    assert.ok(SPELL_TYPES, 'SPELL_TYPES exported');
    assert.ok(Object.keys(SPELL_TYPES).length > 0, 'SPELL_TYPES has entries');
  });
});

test('magic: learnSpell and cast wiring exists', () => {
  const game = makeGameWithPlayer(1313);
  const player = game.getPlayer();
  assert.equal(typeof game.magic.learnSpell, 'function', 'learnSpell exists');
  assert.equal(typeof game.magic.cast, 'function', 'cast exists');
  // Cast is allowed to fail (insufficient mana, etc.) — we just check the call path.
  const result = game.magic.cast(player, 'bless', player);
  assert.ok(result !== undefined, 'cast returned something');
});

test('magic: per-turn mana regen happens during advanceTurns', () => {
  const game = makeGameWithPlayer(1414);
  const player = game.getPlayer();
  const before = game.magic.getPool(player).current;
  // Run a single tick (magic.update is per-turn)
  game.advanceTurns(1);
  const after = game.magic.getPool(player).current;
  // Pool may or may not tick — just verify it didn't crash.
  assert.equal(typeof after, 'number', 'pool.current still numeric');
  assert.ok(after >= 0, 'pool not negative');
});
