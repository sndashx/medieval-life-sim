import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlessedGameUI } from '../src/ui/BlessedGameUI.js';
import { RoguelikeUI } from '../src/ui/RoguelikeUI.js';
import { Combat } from '../src/systems/Combat.js';
import { makeGameWithPlayer } from './_helpers.js';

// BlessedGameUI / RoguelikeUI constructors spin up a real blessed screen which
// requires a TTY. Skip the constructor entirely and attach just enough state
// to drive `attack(args)` synchronously.
function bareInstance(Klass, game) {
  const ui = Object.create(Klass.prototype);
  ui.game = game;
  ui.log = () => {};
  ui.updateDisplay = () => {};
  return ui;
}

function findUniqueNpc(game, player, nameFragment) {
  const kernel = game.kernel;
  const matches = [];
  for (const id of kernel.entities.keys()) {
    const e = kernel.entities.get(id);
    if (!e || e === player) continue;
    if (e.alive === false) continue;
    if (e.type !== 'person') continue;
    if (nameFragment && !e.name.toLowerCase().includes(nameFragment.toLowerCase())) continue;
    matches.push(e);
  }
  // Require a single match — otherwise the attack handler's name search is ambiguous.
  if (matches.length !== 1) return null;
  return matches[0];
}

// Find the first person whose name is unique among all persons in the world.
// The attack handler's name search is string-based, so duplicate names create
// ambiguity about which NPC the handler picks.
function pickUniqueTarget(game, player) {
  const persons = [];
  for (const e of game.kernel.entities.values()) {
    if (e.type !== 'person' || e === player || !e.alive) continue;
    persons.push(e);
  }
  const counts = {};
  for (const p of persons) counts[p.name] = (counts[p.name] || 0) + 1;
  return persons.find(p => counts[p.name] === 1) || null;
}

function placeAdjacent(game, player, npc) {
  const idx = game.kernel.entityIndex;
  // Move ALL persons far away so only our sacrificial npc is in range.
  for (const e of game.kernel.entities.values()) {
    if (e === player || e === npc) continue;
    if (e.type !== 'person') continue;
    try { idx.remove(e); } catch (_) {}
    e.position = { x: 1000, y: 1000, z: 0 };
    try { idx.add(e); } catch (_) {}
  }
  try { idx.remove(player); } catch (_) {}
  try { idx.remove(npc); } catch (_) {}
  player.position = { x: 10, y: 10, z: 0 };
  npc.position = { x: 10, y: 11, z: 0 };
  try { idx.add(player); } catch (_) {}
  try { idx.add(npc); } catch (_) {}
}

// Stub Combat.resolveAttack so the test deterministically hits and applies
// enough damage to drive bloodVolume below the Physiology.checkVitals threshold.
// Restores the original on cleanup via the returned t.mock.
function stubLethalHit(t, game) {
  const origCombat = Combat.resolveAttack;
  const origAdvance = game.advanceTurns;
  Combat.resolveAttack = (attacker, defender, weapon, targetLocation, kernel) => {
    // Drain blood below the 2.0 threshold so checkVitals reports dead.
    defender.physiology.bloodVolume = 0;
    return { hit: true, damage: 1.0, location: targetLocation, injury: { severity: 1 } };
  };
  // Skip advanceTurns so unrelated per-turn systems (pathogens, etc.) can't
  // re-mark the target dead with a different cause before our assertion runs.
  game.advanceTurns = () => {};
  t.after(() => {
    Combat.resolveAttack = origCombat;
    game.advanceTurns = origAdvance;
  });
}

test('Blessed attack: lethal blow kills target (alive=false, deathCause=combat)', (t) => {
  const game = makeGameWithPlayer(7777, undefined, 'Hero');
  stubLethalHit(t, game);
  const player = game.getPlayer();
  player.inventory = [{ type: 'weapon', name: 'sword' }];

  const target = pickUniqueTarget(game, player);
  assert.ok(target, 'need a uniquely-named NPC to attack');
  placeAdjacent(game, player, target);

  const ui = bareInstance(BlessedGameUI, game);
  ui.attack([target.name.split(' ')[0]]);

  assert.equal(target.alive, false, 'target should be marked dead');
  assert.equal(target.deathCause, 'combat', `deathCause was ${target.deathCause}`);
});

test('Roguelike attack: lethal blow kills target (alive=false, deathCause=combat)', (t) => {
  const game = makeGameWithPlayer(8888, undefined, 'Hero');
  stubLethalHit(t, game);
  const player = game.getPlayer();
  player.inventory = [{ type: 'weapon', name: 'sword' }];

  const target = pickUniqueTarget(game, player);
  assert.ok(target, 'need a uniquely-named NPC to attack');
  placeAdjacent(game, player, target);

  const ui = bareInstance(RoguelikeUI, game);
  ui.attack([target.name.split(' ')[0]]);

  assert.equal(target.alive, false, 'target should be marked dead');
  assert.equal(target.deathCause, 'combat', `deathCause was ${target.deathCause}`);
});