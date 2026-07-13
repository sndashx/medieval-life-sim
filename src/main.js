#!/usr/bin/env node

import { Game } from './Game.js';
import { BlessedGameUI } from './ui/BlessedGameUI.js';
import { WorldGenConfigUI } from './ui/WorldGenConfigUI.js';

async function main() {
  console.log('🏰 Medieval Life Simulation\n');

  const seed = process.argv[2] && !isNaN(parseInt(process.argv[2]))
    ? parseInt(process.argv[2])
    : Date.now(); // AUDIT-WHITELIST: cli seed fallback

  console.log(`World Seed: ${seed}\n`);

  const configUI = new WorldGenConfigUI();
  const worldConfig = await configUI.show();
  configUI.close();

  console.log('\nInitializing with selected configuration...\n');

  try {
    const game = new Game(seed, worldConfig);

    const initPromise = new Promise((resolve, reject) => {
      const result = game.initialize();
      if (result.success) resolve(result);
      else reject(new Error(result.error));
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout - world generation taking too long')), 60000);
    });

    await Promise.race([initPromise, timeoutPromise]);

    console.log('\n✓ World initialized successfully!\n');

    const ui = new BlessedGameUI(game);
    ui.start();

  } catch (error) {
    console.error('\n❌ Failed to start game:', error.message);
    console.error('\nTry using a different seed or check the world generation settings.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});