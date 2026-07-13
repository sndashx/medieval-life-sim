import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prosthetics, PROSTHETIC_CATALOG } from '../src/systems/Prosthetics.js';
import { makeGameWithPlayer } from './_helpers.js';

function makePerson(id = 9001, occupation = 'peasant') {
  return {
    id,
    name: `Test${id}`,
    occupation,
    health: 100,
    dead: false,
    skills: { medical: { surgery: { level: 2 } } }
  };
}

function findCraftsman(game, trade) {
  for (const ent of game.kernel.entities.values()) {
    if (ent && ent.occupation === trade && ent.dead !== true) return ent;
  }
  return null;
}

test('prosthetics: class is constructible', () => {
  const game = makeGameWithPlayer(11);
  const p = new Prosthetics(game.kernel, game);
  assert.ok(p instanceof Prosthetics, 'instance of Prosthetics');
  assert.equal(typeof p.fitProsthetic, 'function');
  assert.equal(typeof p.update, 'function');
  assert.equal(typeof p.removeProsthetic, 'function');
});

test('prosthetics: getCatalog returns 6+ types', () => {
  const game = makeGameWithPlayer(22);
  const p = new Prosthetics(game.kernel, game);
  const cat = p.getCatalog();
  assert.ok(Array.isArray(cat), 'catalog is array');
  assert.ok(cat.length >= 6, `catalog has ${cat.length} entries (>=6)`);
  const ids = cat.map((c) => c.id);
  for (const required of ['peg_leg', 'hook_hand', 'iron_hand', 'wooden_hand', 'false_nose', 'glass_eye']) {
    assert.ok(ids.includes(required), `catalog includes ${required}`);
  }
});

test('prosthetics: fitProsthetic succeeds when craftsman is available', () => {
  const game = makeGameWithPlayer(33);
  const p = new Prosthetics(game.kernel, game);
  const patient = makePerson(9001);
  const carpenter = makePerson(9002, 'carpenter');
  const res = p.fitProsthetic(patient, 'peg_leg', carpenter, 'leg');
  assert.equal(res.success, true, `reason: ${res.message}`);
  assert.equal(res.prostheticId, 'peg_leg');
  const current = p.getProsthetic(patient, 'leg');
  assert.ok(current, 'prosthetic recorded');
  assert.equal(current.status, 'recovering');
});

test('prosthetics: fitProsthetic fails without a craftsman (manual, requires craftsman)', () => {
  const game = makeGameWithPlayer(44);
  const p = new Prosthetics(game.kernel, game);
  const patient = makePerson(9001);
  // No craftsman at all.
  const res = p.fitProsthetic(patient, 'peg_leg', null, 'leg');
  assert.equal(res.success, false, 'must fail without craftsman');
  assert.match(res.message, /carpenter/i);
  // Wrong trade.
  const baker = makePerson(9002, 'baker');
  const res2 = p.fitProsthetic(patient, 'peg_leg', baker, 'leg');
  assert.equal(res2.success, false, 'must fail with wrong trade');
});

test('prosthetics: recovery time decreases over turns', () => {
  const game = makeGameWithPlayer(55);
  const p = new Prosthetics(game.kernel, game);
  const patient = makePerson(9001);
  const carpenter = makePerson(9002, 'carpenter');
  assert.equal(p.fitProsthetic(patient, 'peg_leg', carpenter, 'leg').success, true);
  const t0 = p.getRecoveryTime(patient, 'leg');
  assert.ok(t0 > 0, `initial recovery ${t0} > 0`);
  for (let i = 0; i < 3000; i++) game.advanceTurns(1);
  p.update(game.kernel);
  const mid = p.getRecoveryTime(patient, 'leg');
  assert.ok(mid < t0, `mid (${mid}) < t0 (${t0})`);
  for (let i = 0; i < 3000; i++) game.advanceTurns(1);
  p.update(game.kernel);
  const final = p.getRecoveryTime(patient, 'leg');
  assert.equal(final, 0, 'recovery fully elapsed');
  assert.equal(p.getProsthetic(patient, 'leg').status, 'functional', 'status now functional');
});

test('prosthetics: removeProsthetic removes the prosthetic', () => {
  const game = makeGameWithPlayer(66);
  const p = new Prosthetics(game.kernel, game);
  const patient = makePerson(9001);
  const carpenter = makePerson(9002, 'carpenter');
  assert.equal(p.fitProsthetic(patient, 'wooden_hand', carpenter, 'hand').success, true);
  assert.ok(p.getProsthetic(patient, 'hand'), 'installed');
  const out = p.removeProsthetic(patient, 'hand');
  assert.equal(out.success, true);
  assert.equal(p.getProsthetic(patient, 'hand'), null, 'gone after removal');
});

test('prosthetics: 1000-turn game sim does not throw', () => {
  const game = makeGameWithPlayer(77);
  game.prosthetics = new Prosthetics(game.kernel, game);
  const patient = makePerson(9001);
  const carpenter = makePerson(9002, 'carpenter');
  game.prosthetics.fitProsthetic(patient, 'peg_leg', carpenter, 'leg');
  game.prosthetics.fitProsthetic(makePerson(9003), 'wooden_hand', carpenter, 'hand');
  assert.doesNotThrow(() => {
    for (let i = 0; i < 1000; i++) game.advanceTurns(1);
    game.prosthetics.update(game.kernel);
  }, '1000 turns of simulation');
  // sanity: catalog still has 8 entries (the relic is one of them).
  assert.equal(game.prosthetics.getCatalog().length, Object.keys(PROSTHETIC_CATALOG).length);
});
