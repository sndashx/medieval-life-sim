#!/usr/bin/env node

import { Game } from './Game.js';
import { BlessedGameUI } from './ui/BlessedGameUI.js';
import { readFileSync } from 'fs';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    seed: undefined,
    worldConfig: {},
    gameOptions: {}
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--seed' && args[i + 1]) {
      config.seed = parseInt(args[++i]);
    } else if (arg === '--aaa-preset' && args[i + 1]) {
      config.gameOptions.aaaPreset = args[++i];
    } else if (arg === '--aaa-config' && args[i + 1]) {
      const configPath = args[++i];
      try {
        const configData = readFileSync(configPath, 'utf8');
        config.gameOptions.aaaConfig = JSON.parse(configData);
      } catch (e) {
        console.error(`Failed to load AAA config from ${configPath}:`, e.message);
        process.exit(1);
      }
    } else if (arg === '--population' && args[i + 1]) {
      const pop = parseInt(args[++i]);
      config.worldConfig.populationMax = pop;
      config.worldConfig.populationMin = Math.floor(pop * 0.1);
    } else if (arg === '--world-size' && args[i + 1]) {
      const size = args[++i].split('x');
      if (size.length === 2) {
        config.worldConfig.worldSize = {
          width: parseInt(size[0]),
          height: parseInt(size[1])
        };
      }
    } else if (arg === '--settlements' && args[i + 1]) {
      config.worldConfig.settlements = parseInt(args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('--') && config.seed === undefined) {
      // Legacy: first positional arg is seed
      config.seed = parseInt(arg);
    }
  }
  
  return config;
}

function printHelp() {
  console.log(`
Medieval Life Sim - Launch Options

Usage: node src/main-blessed.js [options]

Options:
  --seed <number>              Random seed for reproducibility
  --aaa-preset <preset>        AAA NPC preset (narrative|balanced|performance|minimal)
  --aaa-config <file>          Load AAA config from JSON file
  --population <number>        Maximum population (default: 500)
  --world-size <width>x<height> World dimensions (default: 100x100)
  --settlements <number>       Number of settlements (default: 5)
  --help, -h                   Show this help message

Examples:
  # Basic launch
  npm start

  # With AAA NPCs (narrative preset)
  node src/main-blessed.js --aaa-preset narrative

  # Custom world with AAA
  node src/main-blessed.js --seed 42 --population 1000 --aaa-preset balanced

  # Large world with performance preset
  node src/main-blessed.js --world-size 200x200 --population 2000 --aaa-preset performance

For more information, see LAUNCH.md
`);
}

// Parse arguments
const config = parseArgs();

// Log configuration
console.log('🎮 Medieval Life Sim');
console.log('═══════════════════════════════════════════════════════════\n');
if (config.seed) console.log(`Seed: ${config.seed}`);
if (config.gameOptions.aaaPreset) {
  console.log(`AAA Preset: ${config.gameOptions.aaaPreset}`);
}
if (config.worldConfig.populationMax) {
  console.log(`Population: ${config.worldConfig.populationMin}-${config.worldConfig.populationMax}`);
}
if (config.worldConfig.worldSize) {
  console.log(`World Size: ${config.worldConfig.worldSize.width}x${config.worldConfig.worldSize.height}`);
}
console.log('');

// Create game instance
const game = new Game(
  config.seed,
  Object.keys(config.worldConfig).length > 0 ? config.worldConfig : null,
  config.gameOptions
);

// Initialize world
console.log('Initializing world...');
const initResult = game.initialize();
if (!initResult.success) {
  console.error('Failed to initialize world:', initResult.error);
  process.exit(1);
}

console.log('✓ World initialized\n');

// Initialize blessed UI
const ui = new BlessedGameUI(game);

// Start the game
ui.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});