import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Curses,
  CURSE_REGISTRY,
  BLESSING_REGISTRY
} from '../src/systems/Curses.js';
import { makeGameWithPlayer } from './_helpers.js';

function makePriest(id = 8001) {
  return {
    id,
    name: `Priest${id}`,
    occupation: 'priest',
    health: 100,
    dead: false,
    location: { x: 0, y: 0, biome: 'church' },
    skills: { mental: { faith: { level: 6 } } }
  };
}

function makeCommoner(id = 8002) {
  return {
    id,
    name: `Commoner${id}`,
    occupation: 'peasant',
    health: 100,
    dead: false,
    location: { x: 0, y: 0, biome: 'rural' },
    skills: {}
  };
}

test('curses: class is constructible', () => {
  const game = makeGameWithPlayer(1001);
  const c = new Curses(game.kernel, game);
  assert.ok(c instanceof Curses, 'instance');
  assert.equal(typeof c.triggerEvent, 'function');
  assert.equal(typeof c.attemptRitual, 'function');
  assert.equal(typeof c.removeEffect, 'function');
  assert.equal(typeof c.update, 'function');
});

test('curses: getCurses returns 4+ curse types', () => {
  const game = makeGameWithPlayer(1002);
  const c = new Curses(game.kernel, game);
  const list = c.getCurses();
  assert.ok(Array.isArray(list), 'list is array');
  assert.ok(list.length >= 4, `list has ${list.length} entries (>=4)`);
  for (const required of ['lycanthropy', 'witches_mark', 'fairy_blood', 'vampirism']) {
    assert.ok(list.some((x) => x.id === required), `curse registry includes ${required}`);
  }
});

test('curses: getBlessings returns 4+ blessing types', () => {
  const game = makeGameWithPlayer(1003);
  const c = new Curses(game.kernel, game);
  const list = c.getBlessings();
  assert.ok(Array.isArray(list), 'list is array');
  assert.ok(list.length >= 4, `list has ${list.length} entries (>=4)`);
  for (const required of ['saints_favor', 'divine_oracle', 'sacred_vow', 'blessed_touch']) {
    assert.ok(list.some((x) => x.id === required), `blessing registry includes ${required}`);
  }
});

test('curses: triggerEvent applies the curse/blessing to a person', () => {
  const game = makeGameWithPlayer(1004);
  const c = new Curses(game.kernel, game);
  const person = makeCommoner();
  const r1 = c.triggerEvent(person, 'werewolf_bite');
  assert.equal(r1.success, true, `lycanthropy: ${r1.message ?? ''}`);
  assert.ok(r1.curseId, 'curseId returned');
  const r2 = c.triggerEvent(person, 'pilgrimage');
  assert.equal(r2.success, true, `pilgrimage: ${r2.message ?? ''}`);
  assert.ok(r2.blessingId, 'blessingId returned');
  // Re-triggering same curse should fail.
  const r3 = c.triggerEvent(person, 'werewolf_bite');
  assert.equal(r3.success, false, 'no double-affliction');
});

test('curses: getEffects lists active effects', () => {
  const game = makeGameWithPlayer(1005);
  const c = new Curses(game.kernel, game);
  const person = makeCommoner();
  assert.equal(c.getEffects(person).length, 0, 'no effects initially');
  c.triggerEvent(person, 'changeling_swap');
  c.triggerEvent(person, 'pilgrimage');
  const effs = c.getEffects(person);
  assert.equal(effs.length, 2, `2 effects, got ${effs.length}`);
  const labels = effs.map((e) => e.label);
  assert.ok(labels.includes('Fairy Blood'));
  assert.ok(labels.includes("Saint's Favor"));
});

test('curses: attemptRitual requires skill tier gate (fails below tier)', () => {
  const game = makeGameWithPlayer(1006);
  const c = new Curses(game.kernel, game);
  // Commoner with no faith skill => religion tier 0.
  const commoner = makeCommoner();
  // saints_favor requires religion tier 3.
  const r = c.attemptRitual(commoner, 'blessing', 'saints_favor');
  assert.equal(r.success, false, 'commoner must fail gated blessing');
  assert.match(r.message, /religion/i);
});

test('curses: attemptRitual succeeds when skill tier is met', () => {
  const game = makeGameWithPlayer(1007);
  const c = new Curses(game.kernel, game);
  const priest = makePriest();
  // Run enough trials to overcome the 50% success roll.
  let succeeded = false;
  for (let i = 0; i < 25 && !succeeded; i++) {
    const r = c.attemptRitual(priest, 'blessing', 'saints_favor');
    if (r.success) succeeded = true;
  }
  assert.ok(succeeded, 'priest with religion tier>=3 eventually succeeds');
  const effs = c.getEffects(priest);
  assert.ok(effs.some((e) => e.label === "Saint's Favor"), 'priest carries the blessing');
});

test('curses: removeEffect clears the effect', () => {
  const game = makeGameWithPlayer(1008);
  const c = new Curses(game.kernel, game);
  const person = makeCommoner();
  c.triggerEvent(person, 'werewolf_bite');
  assert.equal(c.getEffects(person).length, 1, 'lycanthropy applied');
  // Try wrong removal method.
  const wrong = c.removeEffect(person, 'lycanthropy', 'severance');
  assert.equal(wrong.success, false, 'severance cannot lift curse');
  // Correct: exorcism.
  const ok = c.removeEffect(person, 'lycanthropy', 'exorcism');
  assert.equal(ok.success, true, 'exorcism lifts curse');
  assert.equal(c.getEffects(person).length, 0, 'effects cleared');
});

test('curses: 1000-turn game sim does not throw', () => {
  const game = makeGameWithPlayer(1009);
  game.curses = new Curses(game.kernel, game);
  assert.doesNotThrow(() => {
    for (let i = 0; i < 1000; i++) game.advanceTurns(1);
    game.curses.update(game.kernel);
  }, '1000 turns of simulation');
  // Sanity: registries intact and of stable size.
  assert.ok(game.curses.getCurses().length >= 4);
  assert.ok(game.curses.getBlessings().length >= 4);
});
