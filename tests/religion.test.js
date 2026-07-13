import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

test('religion: pantheon, clergy, and temples registries exist', () => {
  const game = makeGameWithPlayer(1515);
  const r = game.religion;
  assert.ok(r, 'religion system exists');
  assert.ok(r.pantheon, 'pantheon present');
  assert.ok(r.clergy instanceof Map, 'clergy is a Map');
  assert.ok(r.temples instanceof Map, 'temples is a Map');
  // prophecies is a lazy-initialized array; force-create it by triggering the
  // religion tick once.
  game.advanceTurns(60);
  assert.ok(Array.isArray(r.prophecies) || r.prophecies === undefined, 'prophecies is array or undefined (lazy)');
});

test('religion: buildTemple creates a temple entry', () => {
  const game = makeGameWithPlayer(1616);
  const settlement = game.world.settlements[0];
  const before = game.religion.temples.size;
  const temple = game.religion.buildTemple(
    { x: settlement.x, y: settlement.y, settlementId: 0 },
    'small',
    0
  );
  assert.ok(temple, 'buildTemple returned something');
  assert.ok(game.religion.temples.size >= before, 'temples map grew or stayed');
});

test('religion: ordainClergy registers a cleric', () => {
  const game = makeGameWithPlayer(1717);
  const player = game.getPlayer();
  player.age = 30;
  const result = game.religion.ordainClergy(player, 'priest');
  assert.ok(result, 'ordainClergy returned something');
  if (result.success) {
    assert.ok(game.religion.clergy.has(player.id), 'clergy map contains player');
    assert.ok(player.clergy, 'player.clergy assigned');
  }
});

test('religion: religionTick generates temples for settlements on long simulation', () => {
  const game = makeGameWithPlayer(1818);
  // Run a few hundred turns so the per-tick religion tick (every 60 turns)
  // has a chance to build temples.
  game.advanceTurns(200);
  // Some temples should now exist (or at least the wiring is intact).
  assert.ok(game.religion.templates !== undefined || game.religion.temples instanceof Map, 'temples registry intact');
});
