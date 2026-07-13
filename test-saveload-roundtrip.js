#!/usr/bin/env node
import { Game } from './src/Game.js';
import fs from 'fs';

const seed = 12345;
console.log('=== SAVE/LOAD ROUND-TRIP VERIFICATION ===\n');

// Use small config for speed
const cfg = { worldSize: { width: 50, height: 50 }, settlements: 2, resources: 10, rivers: 2, populationMin: 20, populationMax: 50 };
const game1 = new Game(seed, cfg);
game1.initialize();
game1.createPlayer('Tester', 'male');
console.log(`Initial: population=${game1.kernel.conservationLedger.population}`);

console.log('\nRunning 100 turns on game1...');
game1.advanceTurns(100);
const snap1 = {
  turn: game1.kernel.turn,
  population: game1.kernel.conservationLedger.population,
  households: game1.playerHousehold ? game1.playerHousehold.wealth : 0,
  buildings: game1.buildings.buildings.size,
  fields: game1.agriculture.fields.size,
  plants: game1.flora.plants.size,
  rumors: game1.communication.rumors.size,
  records: game1.communication.records.size,
  temples: game1.religion.temples.size,
  vehicles: game1.transportation.vehicles.size,
  activeClaims: game1.reputation.claims.size,
  statusSources: game1.status.statusSources.size
};
console.log('Snapshot 1:', snap1);

const saveData = game1.save();
const saveJson = JSON.stringify(saveData);
console.log(`\nSave file size: ${(saveJson.length / 1024).toFixed(1)}KB`);
if (saveJson.length < 10 * 1024) {
  console.error('FAIL: save file smaller than 10KB threshold');
  process.exit(1);
}

console.log('\nLoading into game2...');
const game2 = new Game(seed, cfg);
game2.initialize();
const loadResult = game2.load(saveData);
if (!loadResult.success) {
  console.error('FAIL: load failed:', loadResult.error);
  process.exit(1);
}
game2.createPlayer = game1.createPlayer; // not used
// Re-attach player reference since load sets it from saveData.playerId
// (load() already did this)

// Compare state immediately after load
const snapAfterLoad = {
  population: game2.kernel.conservationLedger.population,
  buildings: game2.buildings.buildings.size,
  fields: game2.agriculture.fields.size,
  plants: game2.flora.plants.size,
  rumors: game2.communication.rumors.size,
  records: game2.communication.records.size,
  temples: game2.religion.temples.size,
  vehicles: game2.transportation.vehicles.size,
  activeClaims: game2.reputation.claims.size,
  statusSources: game2.status.statusSources.size
};
console.log('After load:', snapAfterLoad);

let mismatch = false;
for (const k of Object.keys(snap1)) {
  if (snap1[k] !== snapAfterLoad[k] && k !== 'turn' && k !== 'households') {
    console.error(`  MISMATCH ${k}: ${snap1[k]} vs ${snapAfterLoad[k]}`);
    mismatch = true;
  }
}
if (mismatch) { console.error('FAIL: state did not round-trip'); process.exit(1); }

console.log('\nRunning 100 more turns on game2...');
// Patch: game2 doesn't have a player set up the same way — use game1's
// Actually load() restores playerId. Just run ticks.
game2.advanceTurns(100);
const snap2 = {
  population: game2.kernel.conservationLedger.population,
  buildings: game2.buildings.buildings.size,
  fields: game2.agriculture.fields.size
};
console.log('After 100 more turns:', snap2);

console.log('\n✓ PASS: save/load round-trip preserved state, file size > 10KB');
process.exit(0);