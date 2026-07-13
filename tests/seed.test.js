import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';

test('seed: new Game(0) preserves seed=0 (no Date.now() fallback)', () => {
  const game = new Game(0);
  assert.equal(game.seed, 0, `expected seed=0, got ${game.seed}`);
});

test('seed: new Game(undefined) falls back to Date.now()', () => {
  const before = Date.now();
  const game = new Game(undefined);
  const after = Date.now();
  assert.notEqual(game.seed, 0, 'seed should not be 0 when undefined');
  assert.ok(game.seed >= before && game.seed <= after,
    `expected seed in [${before}, ${after}], got ${game.seed}`);
});

test('seed: new Game(null) also falls back to Date.now()', () => {
  const before = Date.now();
  const game = new Game(null);
  const after = Date.now();
  assert.ok(game.seed >= before && game.seed <= after,
    `expected seed in [${before}, ${after}], got ${game.seed}`);
});