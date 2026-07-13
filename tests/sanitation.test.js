import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sanitation } from '../src/systems/Sanitation.js';
import { SeededRNG } from '../src/core/SimulationKernel.js';
import { Game } from '../src/Game.js';

const TURNS_PER_DAY = 1440;

// Minimal kernel stub: enough surface for Sanitation.update to run.
function makeKernel(turn = 0, seed = 12345) {
  const scheduled = [];
  return {
    turn,
    rng: new SeededRNG(seed),
    scheduleEvent: (evt) => scheduled.push(evt),
    _scheduled: scheduled
  };
}

function makeSettlement(id, population, name = `Settlement ${id}`) {
  return { id, name, population };
}

test('sanitation: class is constructible with (kernel, game)', () => {
  const k = makeKernel();
  const fakeGame = { foo: 'bar' };
  assert.doesNotThrow(() => new Sanitation(k, fakeGame),
    'Sanitation must be constructible with (kernel, game)');
  const s = new Sanitation(k, fakeGame);
  assert.ok(s instanceof Sanitation, 'instance is a Sanitation');
  assert.equal(typeof s.update, 'function', 'update is a function');
  assert.equal(typeof s.initialize, 'function', 'initialize is a function');
  assert.equal(typeof s.getSanitationScore, 'function', 'getSanitationScore is a function');
  assert.equal(typeof s.buildLatrine, 'function', 'buildLatrine is a function');
  assert.equal(typeof s.getLatrines, 'function', 'getLatrines is a function');
  assert.equal(typeof s.updatePersonHygiene, 'function', 'updatePersonHygiene is a function');
  assert.equal(typeof s._checkWaterContamination, 'function', '_checkWaterContamination is a function');
});

test('sanitation: initialize() creates per-settlement latrine state', () => {
  const k = makeKernel();
  const s = new Sanitation(k, {});
  const settlements = [
    makeSettlement(1, 50),
    makeSettlement(2, 120, 'Two'),
    makeSettlement(3, 0, 'Empty')
  ];
  s.initialize(settlements);
  assert.equal(s.settlements.size, 3, 'three settlement states created');
  const a = s.settlements.get(1);
  assert.ok(a, 'state for id=1');
  assert.equal(a.population, 50);
  assert.equal(a.coverage, 0, 'starts at zero coverage');
  assert.ok(Array.isArray(a.latrines), 'latrines is an array');
  assert.equal(a.latrines.length, 0, 'no latrines yet');
  assert.equal(typeof a.waterQuality, 'number', 'waterQuality is numeric');
  assert.equal(typeof a.wasteCapacity, 'number', 'wasteCapacity is numeric');

  // Idempotent: re-initializing must not blow up
  s.initialize(settlements);
  assert.equal(s.settlements.size, 3, 'still three settlement states after re-init');
});

test('sanitation: getSanitationScore returns 0..1 range', () => {
  const k = makeKernel();
  const s = new Sanitation(k, {});
  s.initialize([makeSettlement(1, 100)]);
  for (let i = 0; i < 50; i++) {
    const score = s.getSanitationScore(1);
    assert.ok(score >= 0 && score <= 1, `score ${score} in [0,1]`);
  }
  // Unknown settlement → 0
  assert.equal(s.getSanitationScore(9999), 0, 'unknown settlement returns 0');
});

test('sanitation: buildLatrine increases sanitation score for a settlement', () => {
  const k = makeKernel();
  const s = new Sanitation(k, {});
  s.initialize([makeSettlement(1, 100)]);

  const before = s.getSanitationScore(1);
  const result = s.buildLatrine(1, 'pit');
  assert.equal(result.success, true, 'buildLatrine succeeded');
  assert.ok(typeof result.latrineId === 'number', 'latrineId returned');
  const after = s.getSanitationScore(1);
  assert.ok(after > before, `score increased: ${before} -> ${after}`);

  const latrines = s.getLatrines(1);
  assert.equal(latrines.length, 1, 'one latrine recorded');
  assert.equal(latrines[0].type, 'pit');

  // A second latrine (cesspit) further raises coverage.
  const after2 = s.getSanitationScore(1);
  s.buildLatrine(1, 'cesspit');
  const after3 = s.getSanitationScore(1);
  assert.ok(after3 >= after2, 'additional latrine does not lower score');

  // Unknown type rejected
  const bad = s.buildLatrine(1, 'flush_toilet');
  assert.equal(bad.success, false, 'unknown type rejected');
});

test('sanitation: poor sanitation raises water-contamination event probability', () => {
  const k1 = makeKernel(0, 7);
  const s1 = new Sanitation(k1, {});
  s1.initialize([makeSettlement(1, 200)]);

  // No latrines → very poor sanitation. Run update enough days to emit at
  // least one water_contaminated event with high probability.
  let emitted = 0;
  for (let day = 0; day < 5; day++) {
    k1.turn = (day + 1) * TURNS_PER_DAY;
    s1.update(k1);
    emitted += s1._checkWaterContamination(1, k1.rng) ? 1 : 0;
  }
  assert.ok(emitted > 0, `poor sanitation should emit at least one event (got ${emitted})`);

  // Now test the inverse: a settlement with a high-coverage latrine should
  // not emit (or emit far less often).
  const k2 = makeKernel(0, 7);
  const s2 = new Sanitation(k2, {});
  s2.initialize([makeSettlement(2, 200)]);
  for (let i = 0; i < 20; i++) s2.buildLatrine(2, 'garderobe');
  let emitted2 = 0;
  for (let day = 0; day < 5; day++) {
    k2.turn = (day + 1) * TURNS_PER_DAY;
    s2.update(k2);
    emitted2 += s2._checkWaterContamination(2, k2.rng) ? 1 : 0;
  }
  assert.ok(emitted2 < emitted,
    `high-coverage settlement should emit fewer events (good=${emitted2} vs poor=${emitted})`);

  // Event scheduling integration: when a contamination fires, the kernel
  // should see a `water_contaminated` event scheduled.
  const k3 = makeKernel(0, 99);
  const s3 = new Sanitation(k3, {});
  s3.initialize([makeSettlement(3, 200)]);
  // Pre-fill waste so contamination fires deterministically next tick.
  s3.settlements.get(3).wasteCapacity = 1;
  s3.settlements.get(3).wasteAccumulated = 1e9;
  k3.turn = TURNS_PER_DAY;
  s3.update(k3);
  const fired = s3._checkWaterContamination(3, k3.rng);
  if (fired) {
    const types = k3._scheduled.map(e => e.type);
    assert.ok(types.includes('water_contaminated'),
      'kernel received a water_contaminated event');
  }
});

test('sanitation: 1000-turn game sim runs the update path without throwing', () => {
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
    '1000-turn sim must not throw from sanitation update path');
});

test('sanitation: update is throttled to once per game-day', () => {
  const k = makeKernel(0);
  const s = new Sanitation(k, {});
  s.initialize([makeSettlement(1, 10)]);
  const calls = [];
  const orig = s._accumulateWaste.bind(s);
  s._accumulateWaste = (id, state, turn) => { calls.push(turn); return orig(id, state, turn); };

  s.update(k);             // turn 0, first call
  s.update(k);             // same turn, throttled
  s.update(k);             // still same turn, throttled
  assert.equal(calls.length, 1, 'only one call within the same day');

  k.turn = 1000;           // not yet a full day
  s.update(k);
  assert.equal(calls.length, 1, 'still throttled before 1440 turns');

  k.turn = 1440;           // exactly one day later
  s.update(k);
  assert.equal(calls.length, 2, 'runs again after 1440 turns');
  assert.equal(s._lastUpdateTurn, 1440, '_lastUpdateTurn advanced');
});

test('sanitation: updatePersonHygiene decreases hygiene over time without nutrition effects', () => {
  const k = makeKernel();
  const s = new Sanitation(k, {});
  s.initialize([makeSettlement(1, 50)]);

  const person = {
    id: 100,
    position: { x: 0, y: 0, z: 0, settlementId: 1 },
    nutrition: { calories: 9999, water: 9999 },
    hygiene: { cleanliness: 1.0, diseaseExposure: 0 }
  };
  const beforeNutrition = JSON.stringify(person.nutrition);
  const beforeCleanliness = person.hygiene.cleanliness;

  s.updatePersonHygiene(person, k);

  assert.ok(person.hygiene.cleanliness < beforeCleanliness,
    `cleanliness dropped: ${beforeCleanliness} -> ${person.hygiene.cleanliness}`);
  assert.equal(JSON.stringify(person.nutrition), beforeNutrition,
    'nutrition must not be touched by updatePersonHygiene');
  assert.equal(person.hygiene.diseaseExposure, 0,
    'exposure stays at 0 while cleanliness is still high');

  // Force the low-cleanliness branch to verify diseaseExposure climbs.
  person.hygiene.cleanliness = 0.1;
  s.updatePersonHygiene(person, k);
  assert.ok(person.hygiene.diseaseExposure > 0,
    'exposure rises when cleanliness is low');

  // Hygiene field should be auto-created on a fresh person.
  const naked = { id: 101, position: { settlementId: 1 } };
  s.updatePersonHygiene(naked, k);
  assert.ok(naked.hygiene, 'hygiene object auto-created');
  assert.equal(typeof naked.hygiene.cleanliness, 'number');
});
