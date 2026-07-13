// Integration: command parser coverage.
// Verifies the full command surface listed in GAMEPLAY-GUIDE is at least
// recognised (parsed without throwing) by EnhancedGameUI.handleInput.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer, makeHeadlessUI, exerciseCommands } from './_helpers.js';

const REQUIRED_COMMANDS = [
  'start', 'look', 'move', 'take', 'drop',
  'eat', 'drink', 'sleep', 'work', 'talk',
  'attack', 'save', 'load', 'status', 'inventory',
  'gather', 'hunt', 'plant', 'harvest',
  'gossip', 'propose', 'marry',
  'buy', 'sell', 'craft'
];

test('integration: every required command is recognised by the parser', async () => {
  const game = makeGameWithPlayer(42);
  const ui = await makeHeadlessUI(game);
  const failures = await exerciseCommands(ui, REQUIRED_COMMANDS);
  assert.equal(failures.length, 0,
    `${failures.length}/${REQUIRED_COMMANDS.length} commands failed:\n` +
    failures.map(f => `  ${f.cmd}: ${f.error}`).join('\n'));
});

test('integration: parser also handles command with an argument', async () => {
  const game = makeGameWithPlayer(42);
  const ui = await makeHeadlessUI(game);
  const failures = await exerciseCommands(ui, [
    'move north',
    'plant wheat',
    'sell sword'
  ]);
  assert.equal(failures.length, 0,
    `Argumented commands failed:\n` +
    failures.map(f => `  ${f.cmd}: ${f.error}`).join('\n'));
});