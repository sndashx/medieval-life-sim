import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer, makeHeadlessUI, exerciseCommands } from './_helpers.js';

// Guards for unguarded `i.subtype.toLowerCase()` calls in UI shop/forge/
// butcher handlers. Items without a `subtype` field should be silently
// skipped by name search, not crash the handler.

test('UI: shop/forge/butcher handlers tolerate items without subtype', async () => {
  const game = makeGameWithPlayer(4242);
  const player = game.getPlayer();

  // Inject an item with subtype === undefined into the player inventory.
  player.inventory = player.inventory || { items: [] };
  player.inventory.items = player.inventory.items || [];
  player.inventory.items.push({
    id: 'no-subtype-1',
    type: 'mystery',
    quantity: 1,
    properties: {}
    // intentionally no `subtype` field
  });

  // Likewise inject one into ground items if a getter exists.
  if (game.world) {
    const key = `${player.position.x},${player.position.y}`;
    game.world.groundItems = game.world.groundItems || {};
    game.world.groundItems[key] = [
      { id: 'no-subtype-ground-1', type: 'oddity', quantity: 1 }
    ];
  }

  const ui = await makeHeadlessUI(game);
  ui.quit = () => {};

  const failures = await exerciseCommands(ui, ['buy', 'sell', 'recipes', 'craft']);
  assert.equal(
    failures.length,
    0,
    `commands threw: ${failures.map(f => `${f.cmd}: ${f.error}`).join(' | ')}`
  );
});
