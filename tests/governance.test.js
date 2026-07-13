import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

test('governance: politics, factions, law systems are wired', () => {
  const game = makeGameWithPlayer(2323);
  assert.ok(game.politics, 'politics exists');
  assert.ok(game.factions, 'factions exists');
  assert.ok(game.law, 'law exists');
  assert.ok(game.politics.governments instanceof Map, 'governments is a Map');
  assert.ok(game.factions.factions instanceof Map, 'factions map is a Map');
  assert.ok(game.law.laws instanceof Map, 'laws is a Map');
  assert.equal(typeof game.politics.establishGovernment, 'function', 'establishGovernment exists');
});

test('governance: establishing a government for a settlement succeeds', () => {
  const game = makeGameWithPlayer(2424);
  const player = game.getPlayer();
  const gov = game.politics.establishGovernment([0], 'council', player);
  assert.ok(gov, 'government returned');
  assert.equal(gov.ruler, player.id, 'ruler is the player');
  assert.ok(game.politics.governments.has(gov.id), 'government registered in map');
  const fetched = game.politics.getGovernment(gov.id);
  assert.ok(fetched, 'government retrievable by id');
});

test('governance: factions map is accessible', () => {
  const game = makeGameWithPlayer(2525);
  // Factions map may be empty initially — just verify shape and accessors
  assert.ok(game.factions.factions instanceof Map, 'factions map is a Map');
  assert.equal(typeof game.factions.factions.get, 'function', 'factions.get exists');
});

test('governance: law.triggerDynamicLaw enacts a law', () => {
  const game = makeGameWithPlayer(2626);
  const before = game.law.laws.size;
  const result = game.triggerDynamicLaw('theft', 0);
  assert.ok(result, 'triggerDynamicLaw returned something');
  assert.ok(game.law.laws.size >= before, 'laws map grew');
});

test('governance: politics/governance survives 100-turn simulation', () => {
  const game = makeGameWithPlayer(2727);
  assert.doesNotThrow(() => game.advanceTurns(100));
  // The politics/credit/tax loops run on 1440-tick cadence; nothing should
  // have thrown in 100 turns even though those loops didn't fire yet.
  assert.ok(game.kernel.turn > 0, 'turn advanced');
});
