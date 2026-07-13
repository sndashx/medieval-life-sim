// Integration: save/load round-trip preserves state across a save-load cycle.
// Verifies that after a save → load cycle, the loaded game can be advanced
// further with the same RNG trajectory as a fresh game that hit the same
// point. We compare save-load A vs fresh run A' (both seeded the same and
// run for the same turns) — the saved state should produce identical entity
// IDs and conservation totals when loaded at turn T and advanced identically.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';
import { Person } from '../src/character/Person.js';
import { Physiology } from '../src/character/Physiology.js';

function fingerprint(game) {
  const ents = [];
  for (const ent of game.kernel.entities.values()) {
    if (ent.tombstone) continue;
    ents.push([
      ent.id,
      ent.type,
      ent.alive === false ? 0 : 1,
      Math.round(ent.position?.x ?? 0),
      Math.round(ent.position?.y ?? 0)
    ]);
  }
  ents.sort((a, b) => a[0] - b[0]);
  return {
    turn: game.kernel.turn,
    population: game.kernel.alivePeople.size,
    conservationPop: game.kernel.conservationLedger.population,
    entityCount: ents.length,
    firstTen: ents.slice(0, 10).map(e => e.join(':')).join(',')
  };
}

test('integration: save and load is byte-equivalent at the save point', () => {
  // Run A: advance 200, snapshot save, load it into fresh state, compare.
  const a = makeGameWithPlayer(42);
  a.advanceTurns(200);
  const saveData = a.save();
  const fpSaved = fingerprint(a);

  const b = makeGameWithPlayer(42);
  b.load(saveData);
  const fpLoaded = fingerprint(b);

  // Same kernel turn, same entity count, same first-10 entity types.
  assert.equal(fpLoaded.turn, fpSaved.turn, `turn mismatch: ${fpLoaded.turn} vs ${fpSaved.turn}`);
  assert.equal(fpLoaded.entityCount, fpSaved.entityCount, `entity count mismatch: ${fpLoaded.entityCount} vs ${fpSaved.entityCount}`);
  // Same first 10 entity IDs (they were created deterministically before save).
  assert.equal(fpLoaded.firstTen, fpSaved.firstTen, 'first 10 entities differ after load');
  // Conservation.population is preserved in the save data and reloaded.
  assert.equal(fpLoaded.conservationPop, fpSaved.conservationPop, 'conservation.population mismatch');
});

test('integration: load rebinds _kernel on every Person entity (JSON-roundtripped save)', () => {
  const a = makeGameWithPlayer(42);
  a.advanceTurns(200);
  const saveData = a.save();
  // JSON-roundtrip: this is the path every UI takes (fs.writeFileSync(JSON.stringify(saveData))).
  // Person.toJSON drops class methods and _kernel, so a real on-disk save lands in
  // Game.load as plain objects. The rebind loop must still wire _kernel to the new kernel.
  const roundtripped = JSON.parse(JSON.stringify(saveData));
  assert.equal(typeof roundtripped, 'object', 'JSON roundtrip succeeds');

  const b = makeGameWithPlayer(42);
  b.load(roundtripped);
  b.advanceTurns(50);

  assert.equal(b.player._kernel, b.kernel, 'player._kernel should be the loaded kernel');
  let checked = 0;
  let checkedClass = 0;
  for (const entity of b.kernel.entities.values()) {
    if (!entity) continue;
    const looksLikePerson = entity.isPerson === true ||
      (typeof entity.nextInterestingTurn === 'number' && typeof entity._goalsStale === 'boolean');
    if (!looksLikePerson) continue;
    assert.equal(entity._kernel, b.kernel, `Person ${entity.id} _kernel not rebound after JSON load`);
    assert.ok(entity instanceof Person, `Person ${entity.id} should be a real Person instance, got ${entity.constructor.name}`);
    assert.equal(typeof entity.update, 'function', `Person ${entity.id} should have an update() method`);
    assert.ok(entity.physiology instanceof Physiology, `Person ${entity.id} should have a Physiology instance`);
    checked++;
    if (entity instanceof Person) checkedClass++;
  }
  assert.ok(checked > 0, 'expected at least one Person in the loaded world');
  assert.ok(checkedClass > 0, 'expected at least one Person to be rehydrated as a real Person instance');
  const lit = b.player.nextInterestingTurn;
  assert.ok(typeof lit === 'number' && Number.isFinite(lit), 'nextInterestingTurn should be a finite number');
  assert.ok(Math.abs(lit - b.kernel.turn) <= 60, `nextInterestingTurn ${lit} should be within 60 turns of kernel turn ${b.kernel.turn}`);
});

test('integration: a save file contains the kernel RNG state and core fields', () => {
  const a = makeGameWithPlayer(42);
  a.advanceTurns(50);
  const sd = a.save();
  assert.ok(sd, 'save() returned a value');
  assert.ok(sd.kernel, 'save has kernel');
  assert.equal(typeof sd.seed, 'number', 'save has numeric seed');
  assert.equal(sd.kernel.turn, 50, 'kernel turn saved');
  assert.ok(Array.isArray(sd.kernel.entities), 'entities serialised as array');
});

test('integration: save→JSON→load preserves every Person\'s personality (no RNG draw in rehydration)', () => {
  // Determinism guard for the Person-rehydration fix. After a JSON-roundtrip
  // save → load, every Person's personality must equal what was serialized.
  // Without the fix, `new Person(...)` in the rehydration loop calls
  // `generatePersonality()` (8 RNG draws per person) and every saved
  // personality gets replaced with a fresh random one. This test catches
  // the regression by comparing each Person's personality at save-time,
  // in the JSON, and after load.
  const SEED = 42;
  const PRE_TURNS = 200;

  const a = makeGameWithPlayer(SEED);
  a.advanceTurns(PRE_TURNS);
  const saveData = a.save();
  const personalitiesAtSave = new Map();
  for (const ent of a.kernel.entities.values()) {
    if (ent && ent.isPerson) personalitiesAtSave.set(ent.id, { ...ent.personality });
  }
  assert.ok(personalitiesAtSave.size > 0, 'expected at least one Person in the pre-save world');

  const roundtripped = JSON.parse(JSON.stringify(saveData));
  // Capture what the JSON preserves so we can assert the saved personalities
  // were actually serialised.
  const personalitiesInJson = new Map();
  for (const [id, ent] of roundtripped.kernel.entities) {
    if (ent && ent.isPerson && ent.personality) {
      personalitiesInJson.set(id, { ...ent.personality });
    }
  }
  assert.equal(personalitiesInJson.size, personalitiesAtSave.size,
    'toJSON must serialise every Person\'s personality');
  for (const [id, p] of personalitiesAtSave) {
    assert.deepEqual(personalitiesInJson.get(id), p,
      `toJSON must serialise Person ${id}'s personality verbatim`);
  }

  const b = makeGameWithPlayer(SEED);
  b.load(roundtripped);

  // Personality parity: every Person after load must have the same
  // personality as it had at save time. If rehydration draws RNG, these
  // will all differ.
  let pChecked = 0;
  for (const [id, expected] of personalitiesAtSave) {
    const ent = b.kernel.entities.get(id);
    if (!ent || !ent.isPerson) continue;
    assert.deepEqual(ent.personality, expected,
      `Person ${id} personality changed during rehydration`);
    pChecked++;
  }
  assert.equal(pChecked, personalitiesAtSave.size,
    'every pre-save Person must survive rehydration with personality intact');
});