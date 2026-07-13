import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Communication } from '../src/systems/Communication.js';
import { Language } from '../src/systems/Language.js';
import { SeededRNG } from '../src/core/SimulationKernel.js';
import { Game } from '../src/Game.js';

// Minimal kernel stub: enough surface for Communication.update to do its work.
function makeKernel(turn = 0, seed = 12345) {
  const entities = new Map();
  return {
    turn,
    rng: new SeededRNG(seed),
    entities,
    queryEntitiesNear: () => [], // no neighbors → no spread attempts
    scheduleEvent: () => {},
    _put: (e) => entities.set(e.id, e)
  };
}

function makePerson(id, name, position = { x: 0, y: 0, z: 0 }) {
  return {
    id,
    name,
    type: 'person',
    isPerson: true,
    alive: true,
    position,
    languages: new Map()
  };
}

// Stub Language that always says "yes you can talk" — keeps tests focused on
// the Communication update path rather than the Language API.
function makePermissiveLanguage() {
  return {
    canCommunicate: () => ({ canCommunicate: true, intelligibility: 1.0 })
  };
}

test('communication: game wires the system and exposes an update() function', () => {
  const game = new Game(12345, {
    worldSize: { width: 30, height: 30 },
    settlements: 1, resources: 5, rivers: 1,
    populationMin: 5, populationMax: 8
  });
  game.initialize();
  game.createPlayer('Tester', 'male');
  assert.ok(game.communication, 'game.communication must be wired');
  assert.equal(typeof game.communication.update, 'function',
    'communication.update must be a function (was missing — P0-1 fix)');
  assert.doesNotThrow(() => game.communication.update(game.kernel),
    'update must not throw when called with the kernel');
});

test('communication: update() throttles to once per game-day', () => {
  const lang = makePermissiveLanguage();
  const comm = new Communication(lang);
  const k = makeKernel(0);
  comm.update(k);
  const callsAfterFirst = comm._lastRumorTick;
  comm.update(k); // same turn → must be throttled
  assert.equal(comm._lastRumorTick, callsAfterFirst,
    'second update within the same day must be throttled');
  k.turn = 1440; // exactly 1 game-day later
  comm.update(k);
  assert.equal(comm._lastRumorTick, 1440, 'must run again after 1440 turns');
});

test('communication: update() consumes the seeded RNG, not Math.random', () => {
  const lang = makePermissiveLanguage();
  const k = makeKernel(0, 42);
  // Spy on the kernel's RNG — that's what update() wires in (line 26:
  // `this._rng = kernel.rng`). We want to confirm propagation reads from
  // the seeded source rather than Math.random.
  const rngNext = k.rng.next.bind(k.rng);
  let rngCalls = 0;
  k.rng.next = () => { rngCalls++; return 0.0; /* always below threshold */ };

  const comm = new Communication(lang);
  const alice = makePerson(7, 'Alice', { x: 0, y: 0, z: 0 }); // knows the rumor
  const bob = makePerson(8, 'Bob', { x: 0, y: 0, z: 0 });    // does NOT know it
  k.entities.set(7, alice);
  k.entities.set(8, bob);
  k.queryEntitiesNear = () => [7, 8];
  comm.createRumor('the well is cursed', alice, 1.0, 1.0);
  const [rumor] = comm.rumors.values();
  rumor.turnCreated = -10_000; // very old → high spread probability
  rumor.importance = 1.0;
  k.turn = 1440 * 8;
  comm.update(k);

  assert.ok(rngCalls > 0,
    'update must consume the seeded RNG rather than Math.random (P0-1 determinism fix)');

  // Restore so we don't leak the spy.
  k.rng.next = rngNext;
});

test('communication: createRumor stamps turnCreated for deterministic age math', () => {
  const lang = makePermissiveLanguage();
  const comm = new Communication(lang);
  const src = makePerson(1, 'Bob');
  comm._turnAtCreate = 1234;
  const rumor = comm.createRumor('hello', src, 0.8, 0.5);
  assert.equal(rumor.turnCreated, 1234,
    'createRumor must stamp turnCreated so updateRumorPropagation age math is seeded');
});

test('communication: 1000-turn full game sim does not throw from the wired systems', () => {
  const game = new Game(12345, {
    worldSize: { width: 30, height: 30 },
    settlements: 1, resources: 5, rivers: 1,
    populationMin: 5, populationMax: 8
  });
  game.initialize();
  game.createPlayer('Tester', 'male');
  game.player.age = 25;
  if (game.playerHousehold) game.playerHousehold.food = 10000;
  assert.doesNotThrow(() => game.advanceTurns(1000),
    '1000-turn sim must not throw from communication/language update paths');
});