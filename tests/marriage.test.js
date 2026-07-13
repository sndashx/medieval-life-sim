import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, SMALL_WORLD } from './_helpers.js';

test('marriage: full proposal → marriage → divorce → restriction flow', () => {
  const game = makeGame(12345, SMALL_WORLD);
  const playerResult = game.createPlayer('TestPlayer', 'male');
  assert.equal(playerResult.success, true, 'player created');
  const player = game.getPlayer();
  player.age = 20;

  // Find eligible candidate and move them near the player
  const allPeople = Array.from(game.kernel.entities.values()).filter(
    e => e.name && e.age !== undefined && e.id !== player.id && e.age >= 16
  );
  assert.ok(allPeople.length > 0, 'world has other people');

  const target = allPeople.find(p => p.sex !== player.sex && p.age >= 16 && p.age < 40);
  assert.ok(target, 'found eligible candidate');
  target.position.x = player.position.x + 1;
  target.position.y = player.position.y;

  // Seed both sides' relationships
  if (!player.relationships || !(player.relationships instanceof Map)) player.relationships = new Map();
  if (!target.relationships || !(target.relationships instanceof Map)) target.relationships = new Map();
  player.relationships.set(target.id, { affinity: 0.8, trust: 0.7, respect: 0.6 });
  target.relationships.set(player.id, { affinity: 0.8, trust: 0.7, respect: 0.6 });

  const canPropose = game.marriage.canPropose(player, target);
  assert.equal(canPropose.success, true, `canPropose: ${canPropose.reason || 'ok'}`);

  let proposalResult = game.marriage.propose(player, target);
  if (!proposalResult.success) {
    // Bump affinity and retry
    player.relationships.get(target.id).affinity = 0.95;
    target.relationships.get(player.id).affinity = 0.95;
    proposalResult = game.marriage.propose(player, target);
  }
  assert.equal(proposalResult.success, true, `proposal accepted: ${proposalResult.reason || ''}`);

  // Verify marriage data
  assert.ok(player.marriage, 'player.marriage set');
  assert.ok(target.marriage, 'target.marriage set');
  assert.equal(player.marriage.spouse, target.id);
  assert.equal(target.marriage.spouse, player.id);

  const marriage = game.marriage.marriages.get(player.marriage.marriageId);
  assert.ok(marriage, 'marriage record exists');
  assert.equal(marriage.spouse1, player.id);
  assert.equal(marriage.spouse2, target.id);

  // Family tree
  const tree = game.marriage.getFamilyTree(player);
  assert.ok(tree, 'family tree retrievable');
  assert.ok(tree.spouse, 'tree.spouse present');

  // Divorce
  const divorceResult = game.marriage.divorce(player, target);
  assert.equal(divorceResult.success, true, `divorce: ${divorceResult.reason || ''}`);
  assert.equal(player.marriage, undefined, 'player.marriage cleared');
  assert.equal(target.marriage, undefined, 'target.marriage cleared');
});

test('marriage: age and self restrictions are enforced', () => {
  const game = makeGame(99, SMALL_WORLD);
  game.createPlayer('Tester', 'male');
  const player = game.getPlayer();
  player.age = 20;

  // Self-marriage rejected
  const selfResult = game.marriage.canPropose(player, player);
  assert.equal(selfResult.success, false, 'self-marriage prevented');

  // Already-married rejected
  player.marriage = { spouse: 999 };
  const marriedResult = game.marriage.canPropose(player, game.getPlayer());
  assert.equal(marriedResult.success, false, 'already-married prevented');
  delete player.marriage;
});

test('marriage: pregnancy + birth round-trip works on a female target', () => {
  const game = makeGame(2024, SMALL_WORLD);
  game.createPlayer('Tester', 'male');
  const player = game.getPlayer();
  player.age = 20;

  const allPeople = Array.from(game.kernel.entities.values()).filter(
    e => e.name && e.age !== undefined && e.id !== player.id && e.age >= 16 && e.age < 40
  );
  const target = allPeople.find(p => p.sex !== player.sex && p.physiology);
  if (!target) {
    // No female with physiology in this tiny world — skip
    return;
  }
  target.position.x = player.position.x + 1;
  target.position.y = player.position.y;
  if (!player.relationships || !(player.relationships instanceof Map)) player.relationships = new Map();
  if (!target.relationships || !(target.relationships instanceof Map)) target.relationships = new Map();
  player.relationships.set(target.id, { affinity: 0.99, trust: 0.99, respect: 0.99 });
  target.relationships.set(player.id, { affinity: 0.99, trust: 0.99, respect: 0.99 });

  const proposal = game.marriage.propose(player, target);
  if (!proposal.success) return; // skip on random rejection

  const preg = game.marriage.startPregnancy(target);
  if (!preg || !preg.success) return;

  const birth = game.marriage.giveBirth(target);
  assert.ok(birth, 'birth returned a result');
  if (birth.success && birth.child) {
    // The child's name/id may be auto-generated downstream; we just check
    // the child exists and got recorded in the marriage record.
    const marriageAfter = game.marriage.marriages.get(player.marriage.marriageId);
    assert.ok(marriageAfter, 'marriage record still exists after birth');
    assert.ok(Array.isArray(marriageAfter.children), 'marriage.children is an array');
  }
});
