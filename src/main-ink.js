#!/usr/bin/env node
// Ink TUI launcher — the new default medieval-life-sim entry point.

import { Game } from './Game.js';
import { InkGameUI } from './ui/InkGameUI.js';
import { WorldGenConfigUI } from './ui/WorldGenConfigUI.js';

async function main() {
  const args = process.argv.slice(2);
  const seed = args[0] && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : Date.now(); // AUDIT-WHITELIST: cli seed fallback

  // The Ink TUI requires a real terminal. Catch the common "I'm piped to a
  // script" case early and tell the user how to proceed.
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log('⚠  The Ink TUI requires an interactive terminal (TTY).');
    console.log('   Try one of:');
    console.log('     ./sandboxed-blessed      (blessed/contrib dashboard)');
    console.log('     ./sandboxed-roguelike    (CDDA-style map view)');
    console.log('   Or run me from a real terminal.');
    process.exit(2);
  }

  // WorldGenConfigUI uses readline — close it before Ink starts (avoid double-typing).
  const configUI = new WorldGenConfigUI();
  const worldConfig = await configUI.show();
  configUI.close();

  console.log('Forging the realm…');
  const game = new Game(seed, worldConfig);

  // Initialize with timeout guard.
  const initPromise = new Promise((resolve, reject) => {
    const result = game.initialize();
    if (result.success) resolve(result);
    else reject(new Error(result.error));
  });
  const timeout = new Promise((_, reject) => setTimeout(
    () => reject(new Error('World generation timed out (60s). Try a smaller world in the config menu.')),
    60000,
  ));

  try {
    await Promise.race([initPromise, timeout]);
  } catch (e) {
    console.error('\n❌ Failed to start game:', e.message);
    process.exit(1);
  }

  const ui = new InkGameUI(game);
  try {
    await ui.start();
  } catch (e) {
    if (e && /setRawMode|stdin/i.test(String(e.message))) {
      console.error('\n⚠  Could not enter raw input mode (no TTY?).');
      console.error('   Try running from a real terminal.');
      process.exit(2);
    }
    throw e;
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});