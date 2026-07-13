import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer, makeHeadlessUI } from './_helpers.js';

// Regression test for the unguarded `i.subtype.toLowerCase()` pattern in
// shop/forge/butcher UI handlers. When an item's `subtype` is undefined,
// `.toLowerCase()` throws TypeError. Each handler now guards with
// `(i.subtype ? i.subtype.toLowerCase().includes(q) : false)`.
//
// This test installs an inventory (and shop stock) containing an item
// whose `subtype === undefined`, then exercises the commands whose
// handlers iterate items with that pattern: buy, sell, recipes, craft.

test('subtype-guard: buy does not throw when shop stock lacks subtype', async () => {
  const game = makeGameWithPlayer(4242);
  const ui = await makeHeadlessUI(game);
  // Force browseShop to return one item with subtype === undefined.
  game.trading.browseShop = () => ({
    success: true,
    shop: { id: 'mock', inventory: new Map() },
    items: [{ type: 'mystery-good', subtype: undefined, quantity: 1, price: 1 }]
  });
  game.trading.getShopsNear = () => [{ id: 'mock' }];
  // Should not throw even though itemName search would otherwise call
  // `.toLowerCase()` on undefined.
  await ui.handleInput('buy mystery');
  // No assertion on outcome — only that no throw escaped.
  assert.ok(true);
});

test('subtype-guard: sell does not throw when shop stock lacks subtype', async () => {
  const game = makeGameWithPlayer(4243);
  const ui = await makeHeadlessUI(game);
  game.trading.browseShop = () => ({
    success: true,
    shop: { id: 'mock', inventory: new Map() },
    items: [{ type: 'mystery-good', subtype: undefined, quantity: 1, price: 1 }]
  });
  game.trading.getShopsNear = () => [{ id: 'mock' }];
  await ui.handleInput('sell mystery 1');
  assert.ok(true);
});

test('subtype-guard: recipes does not throw with undefined-subtype item in inventory', async () => {
  const game = makeGameWithPlayer(4244);
  const player = game.getPlayer();
  player.inventory = player.inventory || {};
  player.inventory.items = player.inventory.items || [];
  player.inventory.items.push({ type: 'raw-clump', quantity: 5 });
  // No subtype field at all.
  const ui = await makeHeadlessUI(game);
  await ui.handleInput('recipes');
  assert.ok(true);
});

test('subtype-guard: craft does not throw with undefined-subtype item in inventory', async () => {
  const game = makeGameWithPlayer(4245);
  const player = game.getPlayer();
  player.inventory = player.inventory || {};
  player.inventory.items = player.inventory.items || [];
  player.inventory.items.push({ type: 'ore-chunk', quantity: 3 });
  const ui = await makeHeadlessUI(game);
  // craft with no args is a usage error path; exercise it.
  await ui.handleInput('craft');
  assert.ok(true);
});