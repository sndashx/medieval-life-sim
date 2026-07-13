#!/usr/bin/env node
/**
 * TRACK 7 verification: save -> load -> run -> compare.
 * Exercises schemaVersion, Person state roundtrip, Inventory.weight
 * recompute, and Flora/Fauna biome alignment.
 */

import { Game, SAVE_SCHEMA_VERSION } from './src/Game.js';

const SMALL_WORLD = {
  worldSize: { width: 50, height: 50 },
  settlements: 2,
  resources: 10,
  rivers: 1,
  populationMin: 10,
  populationMax: 30
};

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓', msg);
}

function snapshotStats(game, label) {
  let invWeight = 0;
  let invItems = 0;
  let nonZeroNext = 0;
  let totalNpcs = 0;
  let activeMem = 0;
  let nonEmptyRel = 0;
  let nonEmptyMarriage = 0;
  for (const e of game.kernel.entities.values()) {
    if (!e || !e.isPerson) continue;
    totalNpcs++;
    if (e.inventory) {
      invWeight += e.inventory.weight || 0;
      invItems += (e.inventory.items || []).length;
    }
    if (typeof e.nextInterestingTurn === 'number' && e.nextInterestingTurn > 0) nonZeroNext++;
    if (e.memory && typeof e.memory.size === 'number' && e.memory.size > 0) activeMem++;
    if (e.relationships && e.relationships.size > 0) nonEmptyRel++;
    if (e.marriage) nonEmptyMarriage++;
  }
  return {
    label,
    turn: game.kernel.turn,
    population: game.kernel.conservationLedger.population,
    households: Array.from(game.kernel.entities.values()).filter(e => e && e.type === 'household').length,
    activeTier: game.kernel.activeTier.size,
    regionalTier: game.kernel.regionalTier.size,
    inventoryWeightSum: +invWeight.toFixed(4),
    inventoryItemCount: invItems,
    nextInterestingTurnNonZero: nonZeroNext,
    totalNpcs,
    memoryNonEmpty: activeMem,
    relationshipsNonEmpty: nonEmptyRel,
    marriageNonNull: nonEmptyMarriage,
    floraPlants: game.flora?.plants?.size || 0,
    faunaAnimals: game.fauna?.animals?.size || 0
  };
}

console.log('=== TRACK 7 verification: save/load roundtrip ===\n');

// 1. Build a game with the player, give them some inventory, force a memory event.
console.log('Phase 1: building game...');
const g1 = new Game(12345, SMALL_WORLD);
g1.initialize();
g1.createPlayer('Tester', 'male');
const player = g1.player;

// T7-3: stuff some inventory so we can verify weight survives the roundtrip.
player.inventory.add({ type: 'food', mass: 1.0, calories: 200 });
player.inventory.add({ type: 'tool', mass: 2.5 });
player.inventory.add({ type: 'food', mass: 0.5, calories: 100 });
// Manually break inventory.weight to simulate drift.
player.inventory.weight = 9999;

// T7-2: register a memory event so we have something to verify.
player.memory.remember({ type: 'wedding', person: 2 });
player.nextInterestingTurn = 0; // make player ready to tick

// Pre-load some flora/fauna so we can verify biome prune behaviour.
g1.flora.plants.set('5,5', { x: 5, y: 5, species: 'oak', age: 10 });
// Place an oak in the middle of a desert tile (x=2, y=2 of SMALL_WORLD should be hot/dry).
g1.flora.plants.set('2,2', { x: 2, y: 2, species: 'oak', age: 10 });
g1.fauna.animals.set(1, { id: 1, species: 'deer', x: 5, y: 5 });

g1.advanceTurns(50);
const before = snapshotStats(g1, 'before');
console.log('before:', before);

// 2. Save and immediately reload into a fresh Game.
console.log('\nPhase 2: saving and reloading...');
const saveData = g1.save();
assert(saveData.schemaVersion === SAVE_SCHEMA_VERSION, `save.schemaVersion === ${SAVE_SCHEMA_VERSION}`);
assert(saveData.kernel.entities.length > 0, 'save.kernel.entities is non-empty');

// Verify in the raw JSON that Person fields we care about are present in the saved data.
const playerEntry = saveData.kernel.entities.find(([id]) => id === player.id);
assert(playerEntry, 'player is in saveData.kernel.entities');
const playerSaved = playerEntry[1];
assert(typeof playerSaved.nextInterestingTurn === 'number', 'player.nextInterestingTurn is in save');
assert(playerSaved._hungerCriticalSince !== undefined, 'player._hungerCriticalSince is in save');
assert(playerSaved.memory && Array.isArray(playerSaved.memory.events), 'player.memory.events array is in save');
assert(playerSaved.memory && typeof playerSaved.memory.head === 'number', 'player.memory.head is in save');
assert(playerSaved.memory && typeof playerSaved.memory.size === 'number', 'player.memory.size is in save');
assert(playerSaved.relationships !== undefined, 'player.relationships is in save');
assert(playerSaved.inventory && Array.isArray(playerSaved.inventory.items), 'player.inventory.items is in save');
assert(playerSaved.inventory.weight === 9999, 'saved inventory.weight reflects the drift value');

// 3. Reload into a new Game with the SAME seed/worldConfig so biome comparison is meaningful.
const g2 = new Game(12345, SMALL_WORLD);
const loadResult = g2.load(saveData);
assert(loadResult.success, 'load returns success');

// Person restoration
const p2 = g2.player;
assert(p2 && p2.id === player.id, 'player.id preserved across load');
assert(p2.nextInterestingTurn > 0, `player.nextInterestingTurn re-staggered (>0): got ${p2.nextInterestingTurn}`);
assert(typeof p2._hungerCriticalSince === 'number', 'player._hungerCriticalSince restored');

// Memory restoration
assert(p2.memory instanceof Object, 'player.memory is an object after load');
assert(typeof p2.memory.head === 'number', 'player.memory.head is a number after load');
assert(typeof p2.memory.size === 'number', 'player.memory.size is a number after load');
assert(Array.isArray(p2.memory.events), 'player.memory.events is an array after load');
const recalled = p2.memory.recall({ type: 'wedding' });
assert(recalled.length >= 1, 'remembered event survives roundtrip');

// Relationships restoration
assert(p2.relationships instanceof Map, 'player.relationships is a Map after load');

// T7-3: inventory.weight should now be 1.0 + 2.5 + 0.5 = 4.0 (NOT the 9999 drift).
assert(p2.inventory.weight === 4.0, `inventory.weight recomputed correctly: got ${p2.inventory.weight} (expected 4.0)`);
assert(p2.inventory.items.length === 3, `inventory.items.length preserved: got ${p2.inventory.items.length}`);

// T7-6: biome alignment — at least one plant (the one we placed at (2,2) which is
// likely desert) should be pruned. The (5,5) oak may survive if that tile is grassland/forest.
const afterAlign = snapshotStats(g2, 'after_align');
console.log('after_align:', afterAlign);
const beforeAlignFlora = before.floraPlants;
const afterAlignFlora = afterAlign.floraPlants;
assert(afterAlignFlora < beforeAlignFlora, `flora.plants pruned by biome alignment (${beforeAlignFlora} -> ${afterAlignFlora})`);

// 4. Run 50 more turns and compare entity counts / key stats.
console.log('\nPhase 3: running 50 turns after load...');
g2.advanceTurns(50);
const after = snapshotStats(g2, 'after_50_turns');
console.log('after:', after);

// Population and NPC counts should not differ wildly. Allow some drift from deaths.
const popDelta = Math.abs(after.population - before.population);
assert(popDelta <= 5, `population stable across save/load/50 turns (delta=${popDelta})`);
assert(after.totalNpcs === before.totalNpcs, `totalNpcs unchanged: ${after.totalNpcs}`);

// inventoryWeightSum must stay non-negative and match recomputed state.
assert(after.inventoryWeightSum >= 0, `inventoryWeightSum non-negative: ${after.inventoryWeightSum}`);
assert(Number.isFinite(after.inventoryWeightSum), 'inventoryWeightSum is finite');

// nextInterestingTurn should not be 0 for everyone (idle NPCs are staggered).
assert(after.nextInterestingTurnNonZero >= after.totalNpcs * 0.9,
  `nextInterestingTurn mostly non-zero: ${after.nextInterestingTurnNonZero}/${after.totalNpcs}`);

// memoryNonEmpty should still include the wedding we added.
assert(after.memoryNonEmpty >= 1, `at least one non-empty memory after 50 turns: ${after.memoryNonEmpty}`);

console.log('\n=== TRACK 7 verification passed ===');
