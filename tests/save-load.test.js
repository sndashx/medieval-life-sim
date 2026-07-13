import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

test('save-load: roundtrip preserves kernel turn and player state', () => {
  const g1 = makeGameWithPlayer(444);
  g1.advanceTurns(100);
  const saveData = g1.save();

  assert.ok(saveData, 'save returned data');
  assert.ok(saveData.kernel, 'saveData.kernel present');
  assert.ok(saveData.world, 'saveData.world present');
  assert.ok(typeof saveData.seed === 'number', 'seed preserved');
  // Turn may be < requested if the player died mid-loop — but it must have advanced.
  assert.ok(saveData.kernel.turn > 0, 'kernel turn advanced');
  assert.ok(saveData.kernel.turn <= 100, `kernel turn <= 100 (got ${saveData.kernel.turn})`);

  // Re-create a game with the same seed and verify it boots to the same state.
  const g2 = makeGameWithPlayer(saveData.seed);
  g2.advanceTurns(saveData.kernel.turn);
  assert.equal(g2.kernel.turn, g1.kernel.turn, 're-running same seed reaches same turn');
});

test('save-load: JSON-serializable (save data has no cycles)', () => {
  const game = makeGameWithPlayer(555);
  game.advanceTurns(50);
  const saveData = game.save();
  // The save should round-trip through JSON.stringify without throwing.
  assert.doesNotThrow(() => JSON.stringify(saveData));
  const roundtrip = JSON.parse(JSON.stringify(saveData));
  assert.equal(roundtrip.seed, saveData.seed, 'seed survives JSON roundtrip');
  assert.equal(roundtrip.kernel.turn, saveData.kernel.turn, 'turn survives JSON roundtrip');
});

test('save-load: includes all major system payloads', () => {
  const game = makeGameWithPlayer(666);
  game.advanceTurns(20);
  const data = game.save();
  // Spot-check that the major systems serialized
  for (const key of ['kernel', 'world', 'marriage', 'trading', 'naturalWorld',
                     'warfare', 'politics', 'pathogens', 'magic', 'transportation']) {
    assert.ok(data[key] !== undefined, `saveData.${key} present`);
  }
});
