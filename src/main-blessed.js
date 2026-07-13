#!/usr/bin/env node

import { Game } from './Game.js';
import { BlessedGameUI } from './ui/BlessedGameUI.js';

// Parse command line arguments
const args = process.argv.slice(2);
const seed = args[0] ? parseInt(args[0]) : undefined;

// Create game instance
const game = new Game(seed);

// Initialize world
const initResult = game.initialize();
if (!initResult.success) {
  console.error('Failed to initialize world:', initResult.error);
  process.exit(1);
}

// Initialize blessed UI
const ui = new BlessedGameUI(game);

// Start the game
ui.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
