import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

test('transport: populateForSettlements runs without error', () => {
  const game = makeGameWithPlayer(1919);
  assert.ok(game.transportation, 'transportation system exists');
  // populateForSettlements is called by Game.initialize(); running again is safe
  assert.doesNotThrow(() => {
    game.transportation.populateForSettlements(game.world.settlements);
  });
});

test('transport: travel methods exist and return results', () => {
  const game = makeGameWithPlayer(2020);
  const t = game.transportation;
  assert.equal(typeof t.travel, 'function', 'travel method exists');
  assert.equal(typeof t.fastTravel, 'function', 'fastTravel method exists');
  assert.equal(typeof t.sail, 'function', 'sail method exists');
  assert.equal(typeof t.drive, 'function', 'drive method exists');
  // Try a fast travel that should fail gracefully (no valid route)
  const result = t.fastTravel({ x: 0, y: 0 }, { x: 1, y: 1 });
  assert.ok(result !== undefined, 'fastTravel returns something');
});

test('transport: stable/shipyard/trade route registries are present', () => {
  const game = makeGameWithPlayer(2121);
  const t = game.transportation;
  assert.equal(typeof t.getStable, 'function', 'getStable exists');
  assert.equal(typeof t.getShipyard, 'function', 'getShipyard exists');
  assert.equal(typeof t.getTradeRoutes, 'function', 'getTradeRoutes exists');
});

test('transport: 100 turns of simulation does not throw', () => {
  const game = makeGameWithPlayer(2222);
  assert.doesNotThrow(() => game.advanceTurns(100));
});
