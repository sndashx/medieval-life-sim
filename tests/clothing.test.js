import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
import { Clothing } from '../src/systems/Clothing.js';

const SMALL_WORLD = {
  worldSize: { width: 30, height: 30 },
  settlements: 1,
  resources: 5,
  rivers: 1,
  populationMin: 5,
  populationMax: 8
};

function makeKernel(seed = 42) {
  const game = new Game(seed, SMALL_WORLD);
  return { game, kernel: game.kernel };
}

test('clothing: class is constructible', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  assert.ok(clothing, 'Clothing instance created');
  assert.equal(typeof clothing.update, 'function');
  assert.equal(typeof clothing.equip, 'function');
  assert.equal(typeof clothing.unequip, 'function');
  assert.equal(typeof clothing.getInsulation, 'function');
  assert.equal(typeof clothing.getExposure, 'function');
  assert.equal(typeof clothing.damage, 'function');
  assert.equal(typeof clothing.getWetness, 'function');
  assert.equal(typeof clothing.applyWeather, 'function');
});

test('clothing: equip adds a layer and increases insulation', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9999, isPerson: true, type: 'person', clothing: null };

  const before = clothing.getInsulation(person);
  assert.equal(before, 0, 'starts with zero insulation');

  const result = clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  assert.equal(result.success, true, `equip ok: ${result.reason || ''}`);
  assert.ok(result.insulationDelta > 0, 'insulationDelta > 0');
  assert.ok(person.clothing && person.clothing.layers && person.clothing.layers.torso);
  assert.ok(person.clothing.layers.torso.length === 1);
  assert.ok(clothing.getInsulation(person) > before, 'total insulation increased');
});

test('clothing: unequip removes a layer and decreases insulation', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9998, isPerson: true, type: 'person', clothing: null };

  clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  clothing.equip(person, 'outerwear', { type: 'cloak', material: 'wool', condition: 1 });

  const equipped = clothing.getInsulation(person);
  assert.ok(equipped > 0, 'has insulation');

  const removed = clothing.unequip(person, 'torso');
  assert.ok(removed && removed.type === 'tunic', 'removed the tunic');

  const after = clothing.getInsulation(person);
  assert.ok(after < equipped, `insulation dropped: ${after} < ${equipped}`);
  assert.ok(clothing.getInsulation(person) >= 0);

  const nullResult = clothing.unequip(person, 'torso');
  assert.equal(nullResult, null, 'unequip on empty slot returns null');
});

test('clothing: getInsulation sums all layers (0..1 range)', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9997, isPerson: true, type: 'person', clothing: null };

  assert.equal(clothing.getInsulation(person), 0, 'no layers = 0');

  clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  clothing.equip(person, 'outerwear', { type: 'cloak', material: 'wool', condition: 1 });

  const total = clothing.getInsulation(person);
  assert.ok(total >= 0 && total <= 1, `total in [0,1]: ${total}`);
  assert.ok(total > 0, `expected some insulation with 2 layers: ${total}`);

  clothing.damage(person, 'torso', 1);
  const afterDamage = clothing.getInsulation(person);
  assert.ok(afterDamage >= 0 && afterDamage <= 1, 'stays in [0,1]');
  assert.ok(afterDamage < total, `damage reduces insulation: ${afterDamage} < ${total}`);
});

test('clothing: damage reduces condition and insulation accordingly', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9996, isPerson: true, type: 'person', clothing: null };

  clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  const insFull = clothing.getInsulation(person);
  assert.ok(insFull > 0);

  clothing.damage(person, 'torso', 0.5);
  const layer = person.clothing.layers.torso[0];
  assert.equal(layer.condition, 0.5, 'condition reduced to 0.5');
  const insHalf = clothing.getInsulation(person);
  assert.ok(insHalf < insFull, `insulation dropped: ${insHalf} < ${insFull}`);
  assert.ok(Math.abs(insHalf - insFull * 0.5) < 0.01, 'roughly halved');

  clothing.damage(person, 'torso', 5);
  assert.equal(layer.condition, 0, 'condition clamped at 0');
  assert.equal(clothing.getInsulation(person), 0, 'zero condition = zero insulation');
});

test('clothing: wet clothing reduces effective insulation', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9995, isPerson: true, type: 'person', clothing: null };

  clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  const dry = clothing.getInsulation(person);
  assert.ok(dry > 0);

  const layer = person.clothing.layers.torso[0];
  layer.wetness = 1;
  const wet = clothing.getInsulation(person);
  assert.ok(wet < dry, `wet < dry: ${wet} < ${dry}`);
  assert.ok(wet >= 0, 'still non-negative');

  clothing.applyWeather(person, { rain: 1.0, temperature: 0.1 }, kernel);
  assert.ok(layer.wetness > 0, 'applyWeather keeps layer wet in heavy rain');

  clothing.applyWeather(person, { rain: 0, temperature: 1 }, kernel);
  assert.ok(layer.wetness <= 1, 'dry weather does not blow up wetness');
});

test('clothing: getExposure reports uncovered slots', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = { id: 9994, isPerson: true, type: 'person', clothing: null };

  const naked = clothing.getExposure(person);
  assert.deepEqual(naked, { head: true, hands: true, feet: true, torso: true }, 'all exposed when naked');

  clothing.equip(person, 'torso', { type: 'tunic', material: 'linen', condition: 1 });
  clothing.equip(person, 'feet', { type: 'boots', material: 'leather', condition: 1 });

  const partial = clothing.getExposure(person);
  assert.equal(partial.torso, false, 'torso covered');
  assert.equal(partial.feet, false, 'feet covered');
  assert.equal(partial.head, true, 'head still exposed');
  assert.equal(partial.hands, true, 'hands still exposed');

  clothing.equip(person, 'head', { type: 'hood', material: 'wool', condition: 1 });
  clothing.equip(person, 'hands', { type: 'gloves', material: 'leather', condition: 1 });

  const covered = clothing.getExposure(person);
  assert.equal(covered.head, false);
  assert.equal(covered.hands, false);
  assert.equal(covered.feet, false);
  assert.equal(covered.torso, false);
});

test('clothing: update is throttled to once per game-hour', () => {
  const { game, kernel } = makeKernel();
  const clothing = new Clothing(kernel, game);
  const person = kernel.createEntity({ type: 'person', isPerson: true });
  clothing.equip(person, 'torso', { type: 'tunic', material: 'wool', condition: 1 });
  const layer = person.clothing.layers.torso[0];
  const initialCondition = layer.condition;

  kernel.turn = 0;
  clothing.lastUpdateTurn = -Infinity;
  clothing.update(kernel);
  const condAfterFirst = layer.condition;
  assert.ok(condAfterFirst < initialCondition, 'condition decayed on first update');

  kernel.turn = 30; // within 60-turn window
  clothing.update(kernel);
  assert.equal(layer.condition, condAfterFirst, 'no work done within throttle window');

  kernel.turn = 60;
  clothing.update(kernel);
  assert.ok(layer.condition < condAfterFirst, 'throttled update ran after game-hour');
});

test('clothing: 1000-turn game sim runs the update path without throwing', () => {
  const game = new Game(777, SMALL_WORLD);
  game.initialize();
  game.clothing = new Clothing(game.kernel, game);

  for (let i = 0; i < 1000; i++) {
    game.kernel.tick();
    game.clothing.update(game.kernel);
    const w = {
      rain: ((game.kernel.turn * 13) % 100) / 100,
      temperature: ((game.kernel.turn * 7 + 31) % 100) / 100
    };
    for (const p of game.kernel.alivePeople) {
      try { game.clothing.applyWeather(p, w, game.kernel); } catch (e) { throw e; }
    }
    assert.ok(game.clothing.getInsulation(Array.from(game.kernel.alivePeople)[0] || {}) >= 0);
  }
  assert.ok(true, '1000-turn sim did not throw');
});
