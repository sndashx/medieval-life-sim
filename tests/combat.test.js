import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/systems/Combat.js';
import { makeGameWithPlayer } from './_helpers.js';

test('combat: resolveAttack returns a hit/damage result on a target', () => {
  const game = makeGameWithPlayer(909);
  const player = game.getPlayer();

  // Give attacker a weapon
  player.inventory.add({ type: 'weapon', subtype: 'sword', mass: 1.2, sharpness: 0.9 });
  const weapon = player.inventory.items.find(i => i.type === 'weapon');

  const enemy = game.createPerson({
    name: 'TestEnemy',
    age: 25,
    sex: 'male',
    position: player.position,
    occupation: 'bandit'
  });

  const result = Combat.resolveAttack(player, enemy, weapon, 'torso', game.kernel);
  assert.ok(result, 'result returned');
  assert.equal(typeof result.hit, 'boolean', 'result.hit is boolean');
  if (result.hit) {
    assert.equal(typeof result.damage, 'number', 'result.damage is numeric');
    assert.equal(typeof result.location, 'string', 'result.location is string');
  }
});

test('combat: missing weapon still produces a result (unarmed)', () => {
  const game = makeGameWithPlayer(111);
  const player = game.getPlayer();
  const enemy = game.createPerson({
    name: 'Brawler',
    age: 30,
    sex: 'male',
    position: player.position,
    occupation: 'bandit'
  });
  const result = Combat.resolveAttack(player, enemy, null, 'torso', game.kernel);
  assert.ok(result, 'unarmed result returned');
});

test('combat: combat system is wired on the Game', () => {
  const game = makeGameWithPlayer(222);
  assert.ok(game.combat, 'game.combat exists');
  assert.equal(typeof Combat.resolveAttack, 'function', 'Combat.resolveAttack is callable');
});

test('combat: 50 turns of simulation may or may not produce fights, but must not throw', () => {
  const game = makeGameWithPlayer(333);
  // Don't expect a fight in such a tiny world — just verify the loop is safe.
  assert.doesNotThrow(() => game.advanceTurns(50));
  assert.equal(game.kernel.turn >= 50, true, 'turn advanced');
});
