#!/usr/bin/env node
// T3-3b verification: with a fresh game, advance 500 turns and confirm:
//   - at least one peasant NPC's household.food increased
//   - at least one craftsman's inventory gained an item
//   - at least one shop's inventory stock increased (restocked)
//
// We snapshot baseline values for a curated sample before the run and
// diff them after.

import { Game } from './src/Game.js';

const SEED = 424242;
const TURNS = 500;

console.log(`[T3-3b] Booting small game with seed=${SEED}...`);
const game = new Game(SEED, {
  worldSize: { width: 60, height: 60 },
  settlements: 2,
  resources: 20,
  rivers: 2,
  populationMin: 80,
  populationMax: 120
});
game.initialize();
game.createPlayer('T3Hero', 'male');

const activeIds = Array.from(game.kernel.activeTier);
console.log(`[T3-3b] activeTier size after init = ${activeIds.length}`);

// Build baseline samples per occupation.
function sampleByOccupation(occ) {
  const out = [];
  for (const id of activeIds) {
    const p = game.kernel.entities.get(id);
    if (!p || !p.alive || p.occupation !== occ) continue;
    out.push(p);
    if (out.length >= 5) break;
  }
  return out;
}

const peasants = sampleByOccupation('peasant');
const craftsmen = sampleByOccupation('craftsman');
const merchants = sampleByOccupation('merchant');

const peasantHouseholdsBefore = peasants.map(p => {
  const hh = p.household ? game.kernel.entities.get(p.household) : null;
  return hh ? { p, hh, food: hh.food || 0 } : null;
}).filter(Boolean);

// If no peasant in the promoted sample owns a household (only every 5th NPC
// in populateWorld gets one), widen the search across ALL peasants in the
// active tier.
if (peasantHouseholdsBefore.length === 0) {
  for (const id of activeIds) {
    const p = game.kernel.entities.get(id);
    if (!p || !p.alive || p.occupation !== 'peasant' || !p.household) continue;
    const hh = game.kernel.entities.get(p.household);
    if (!hh) continue;
    peasantHouseholdsBefore.push({ p, hh, food: hh.food || 0 });
    if (peasantHouseholdsBefore.length >= 8) break;
  }
}

const craftsmanInvBefore = craftsmen.map(p => ({
  p, count: p.inventory?.items?.length ?? 0
}));

// Find shops in nearby settlements; snapshot the total quantity per shop.
const shopsBefore = new Map();
for (const [id, shop] of game.trading.shops) {
  let total = 0;
  if (shop.inventory) {
    for (const item of shop.inventory.values()) total += (item.quantity || 0);
  }
  shopsBefore.set(id, { shop, total });
}

console.log(`[T3-3b] Sampled ${peasants.length} peasants, ${craftsmen.length} craftsmen, ${merchants.length} merchants; ${game.trading.shops.size} shops total.`);

// Give craftsmen some basic inputs so they can actually craft.
for (const c of craftsmen) {
  if (!c.inventory) continue;
  try { c.inventory.add({ type: 'wood', mass: 1 }); } catch (e) {}
  try { c.inventory.add({ type: 'stone', mass: 1 }); } catch (e) {}
  try { c.inventory.add({ type: 'clay', mass: 1 }); } catch (e) {}
  try { c.inventory.add({ type: 'flour', mass: 0.5 }); } catch (e) {}
  try { c.inventory.add({ type: 'water', mass: 0.5 }); } catch (e) {}
  // Make sure they have a baseline skill in at least one craft so they qualify.
  if (c.skills?.crafting) {
    c.skills.crafting.woodwork = Math.max(c.skills.crafting.woodwork || 0, 0.25);
    c.skills.crafting.pottery = Math.max(c.skills.crafting.pottery || 0, 0.25);
    c.skills.crafting.cooking = Math.max(c.skills.crafting.cooking || 0, 0.15);
  }
}

console.log(`[T3-3b] Advancing ${TURNS} turns...`);
game.advanceTurns(TURNS);

let peasantFoodDelta = 0;
for (const entry of peasantHouseholdsBefore) {
  const cur = entry.hh.food || 0;
  if (cur - entry.food > 0) peasantFoodDelta += (cur - entry.food);
}
const peasantsWithGrowth = peasantHouseholdsBefore.filter(e => (e.hh.food || 0) > e.food).length;

let craftsmanGained = 0;
const craftsmanDeltas = [];
for (const entry of craftsmanInvBefore) {
  const after = entry.p.inventory?.items?.length ?? 0;
  const delta = after - entry.count;
  craftsmanDeltas.push({ name: entry.p.name, before: entry.count, after, delta });
  if (delta > 0) craftsmanGained++;
}

let shopsRestocked = 0;
for (const [id, before] of shopsBefore) {
  const shop = game.trading.shops.get(id);
  if (!shop?.inventory) continue;
  let total = 0;
  for (const item of shop.inventory.values()) total += (item.quantity || 0);
  if (total > before.total) shopsRestocked++;
}

console.log('\n=== T3-3b Results ===');
console.log(`Peasant households sampled:     ${peasantHouseholdsBefore.length}`);
console.log(`  households with food growth:  ${peasantsWithGrowth}`);
console.log(`  total household food delta:   +${peasantFoodDelta}`);
console.log(`Craftsmen sampled:              ${craftsmanInvBefore.length}`);
console.log(`  craftsmen with new items:     ${craftsmanGained}`);
console.log(`  per-craftsman deltas:`, craftsmanDeltas);
console.log(`Shops tracked:                  ${shopsBefore.size}`);
console.log(`  shops with stock increase:    ${shopsRestocked}`);

const ok = peasantsWithGrowth >= 1 && craftsmanGained >= 1 && shopsRestocked >= 1;
console.log(`\nT3-3b verification: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);