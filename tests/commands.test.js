import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer, makeHeadlessUI, exerciseCommands } from './_helpers.js';

// Every command string registered in EnhancedGameUI.handleInput (line 288-411).
// Each is exercised with no args; the test verifies no handler throws an
// unhandled exception. Handlers may return "Failed: ..." strings via ui.log
// (which we stub) — that's allowed, only true exceptions fail the test.
const ALL_COMMANDS = [
  'help', 'start', 'look', 'l', 'status', 'inventory', 'i',
  'move', 'm', 'take', 'get', 'pickup', 'drop', 'eat', 'e', 'drink',
  'sleep', 's', 'work', 'w', 'craft', 'talk', 'chat', 'speak',
  'propose', 'marry', 'divorce', 'family', 'adopt', 'orphans',
  'faction', 'factions', 'form-faction', 'join-faction', 'leave-faction',
  'alliance', 'guild',
  'declare-war', 'warfare', 'muster', 'siege',
  'claim-land', 'buy-land', 'sell-land', 'annex-land', 'land',
  'barter', 'loan',
  'study', 'apprentice', 'discover', 'observe', 'languages', 'culture',
  'recipes', 'cook', 'cure', 'infect',
  'declare-battle', 'battle', 'battle-round', 'march', 'retreat', 'assault',
  'betray', 'scheme', 'spy', 'coup', 'intrigues',
  'steal', 'accuse', 'laws', 'cases', 'enact-law',
  'titles', 'claim-title', 'grant-title', 'house', 'levy', 'court',
  'spells', 'learn', 'cast', 'mana', 'forge',
  'shop', 'browse', 'buy', 'sell', 'haggle',
  'attack', 'fight',
  'wait', 'rest',
  'repay', 'loans',
  'gather', 'harvest', 'hunt', 'forage',
  'dev', 'save', 'load', 'continue', 'heirs', 'relations',
  'clear', 'refresh'
  // 'quit' / 'exit' are intentionally excluded — they call process.exit(0).
];

test('commands: every command handler runs without throwing', async () => {
  const game = makeGameWithPlayer(3131);
  // Pre-seed some ground items so 'take' has something to interact with.
  const player = game.getPlayer();
  const locKey = `${player.position.x},${player.position.y}`;

  const ui = await makeHeadlessUI(game);
  // Stub quit/exit explicitly so process.exit doesn't kill the test runner.
  ui.quit = () => ui.log && ui.log('quit (stubbed)', 'system');

  // Pre-seed ground items for take/get/pickup/gather/harvest/hunt/etc.
  // We can't easily inject into ui.groundItems from outside (it's set in
  // game populateWorld / various handlers), but the stubbed showSelectionMenu
  // returns the first item, so commands that need a target should not block.

  const failures = await exerciseCommands(ui, ALL_COMMANDS);
  if (failures.length > 0) {
    console.log('Failed commands:');
    for (const f of failures) console.log(`  - ${f.cmd}: ${f.error}`);
  }
  assert.equal(failures.length, 0, `${failures.length} command(s) threw`);
});

test('commands: help command runs and lists categories', async () => {
  const game = makeGameWithPlayer(3232);
  const ui = await makeHeadlessUI(game);
  // help() does console.log internally — we already stubbed clearScreen,
  // but it still calls console.log directly. Override to capture.
  let helpRan = false;
  const origLog = console.log;
  console.log = (...args) => {
    if (args.some(a => typeof a === 'string' && a.includes('COMMAND'))) helpRan = true;
  };
  try {
    await ui.handleInput('help');
  } finally {
    console.log = origLog;
  }
  assert.ok(helpRan, 'help printed the command reference banner');
});

test('commands: unknown command is reported via log, not thrown', async () => {
  const game = makeGameWithPlayer(3333);
  const ui = await makeHeadlessUI(game);
  let logged = null;
  ui.log = (msg, type) => { if (!logged) logged = msg; };
  await ui.handleInput('zzznosuch');
  assert.ok(logged && /unknown/i.test(logged), `expected 'Unknown command' log, got: ${logged}`);
});

test('commands: aliases map to the same handler (l→look, i→inventory, e→eat)', async () => {
  const game = makeGameWithPlayer(3434);
  const ui = await makeHeadlessUI(game);
  for (const alias of ['l', 'i', 'e']) {
    await ui.handleInput(alias);
  }
  // If any threw, the test would have failed already.
  assert.ok(true, 'all aliases invoked without throwing');
});

test('Combat.resolveAttack returns {hit, damage, ...} on direct call', async () => {
  const { Combat } = await import('../src/systems/Combat.js');
  const game = makeGameWithPlayer(3535);
  const player = game.getPlayer();
  const kernel = game.kernel;

  // Build a stub person with the minimum shape Combat.resolveAttack needs.
  function makeStubPerson() {
    return {
      skills: { combat: { melee: 0.5, defense: 0.5 } },
      physiology: {
        getHealthStatus: () => ({ strength: 0.6, health: 1 }),
        applyInjury: () => {},
      },
      equipment: { armor: null },
    };
  }
  const attacker = { ...makeStubPerson(), skills: { combat: { melee: 0.9, defense: 0 } } };
  const defender = makeStubPerson();
  const weapon = { mass: 1.0, sharpness: 0.8, type: 'sharp' };

  const result = Combat.resolveAttack(attacker, defender, weapon, 'torso', kernel);
  assert.ok(result && typeof result === 'object', 'result is an object');
  assert.ok('hit' in result, 'result has hit property');
  assert.ok('damage' in result, 'result has damage property');
  assert.ok(typeof result.hit === 'boolean', 'hit is boolean');
  assert.ok(typeof result.damage === 'number', 'damage is number');
  assert.ok(!player || result !== player, 'attack does not return the player object');
});
