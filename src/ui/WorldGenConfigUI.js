import readline from 'readline';

export class WorldGenConfigUI {
  constructor() {
    this.config = {
      worldSize: { width: 100, height: 100 },
      settlements: 5,
      resources: 50,
      rivers: 5,
      populationMin: 50,
      populationMax: 500
    };
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async show() {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        WORLD GENERATION CONFIGURATION                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    let configuring = true;
    
    while (configuring) {
      this.displayCurrentConfig();
      console.log('\nOptions:');
      console.log('  1. World Size');
      console.log('  2. Number of Settlements');
      console.log('  3. Number of Resources');
      console.log('  4. Number of Rivers');
      console.log('  5. Population Range');
      console.log('  6. Reset to Defaults');
      console.log('  7. Start Game with Current Settings');
      console.log('  0. Quick Start (use defaults)');
      
      const choice = await this.prompt('\nSelect option: ');
      
      switch (choice.trim()) {
        case '1':
          await this.configureWorldSize();
          break;
        case '2':
          await this.configureSettlements();
          break;
        case '3':
          await this.configureResources();
          break;
        case '4':
          await this.configureRivers();
          break;
        case '5':
          await this.configurePopulation();
          break;
        case '6':
          this.resetDefaults();
          console.log('\n✓ Reset to default settings');
          await this.pause();
          break;
        case '7':
        case '':
          configuring = false;
          break;
        case '0':
          this.resetDefaults();
          configuring = false;
          break;
        default:
          console.log('\n❌ Invalid option');
          await this.pause();
      }
      
      console.clear();
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║        WORLD GENERATION CONFIGURATION                     ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');
    }
    
    this.rl.close();
    return this.config;
  }

  displayCurrentConfig() {
    console.log('Current Configuration:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  World Size:        ${this.config.worldSize.width} × ${this.config.worldSize.height}`);
    console.log(`  Settlements:       ${this.config.settlements}`);
    console.log(`  Resources:         ${this.config.resources}`);
    console.log(`  Rivers:            ${this.config.rivers}`);
    console.log(`  Population Range:  ${this.config.populationMin} - ${this.config.populationMax}`);
    console.log('─────────────────────────────────────────────────────────────');
  }

  async configureWorldSize() {
    console.log('\n📐 World Size Configuration');
    console.log('Recommended: 100×100 (fast), 500×500 (medium), 1000×1000 (large)');
    
    const width = await this.promptNumber('Enter world width (50-2000): ', 50, 2000);
    if (width === null) return;
    
    const height = await this.promptNumber('Enter world height (50-2000): ', 50, 2000);
    if (height === null) return;
    
    this.config.worldSize = { width, height };
    console.log(`✓ World size set to ${width}×${height}`);
    await this.pause();
  }

  async configureSettlements() {
    console.log('\n🏘️  Settlement Configuration');
    console.log('More settlements = more NPCs and longer generation time');
    
    const count = await this.promptNumber('Enter number of settlements (1-50): ', 1, 50);
    if (count === null) return;
    
    this.config.settlements = count;
    console.log(`✓ Settlements set to ${count}`);
    await this.pause();
  }

  async configureResources() {
    console.log('\n⛏️  Resource Configuration');
    console.log('Resources include iron, copper, gold, timber, etc.');
    
    const count = await this.promptNumber('Enter number of resource deposits (10-500): ', 10, 500);
    if (count === null) return;
    
    this.config.resources = count;
    console.log(`✓ Resources set to ${count}`);
    await this.pause();
  }

  async configureRivers() {
    console.log('\n🌊 River Configuration');
    console.log('Rivers provide water sources for settlements');
    
    const count = await this.promptNumber('Enter number of rivers (0-20): ', 0, 20);
    if (count === null) return;
    
    this.config.rivers = count;
    console.log(`✓ Rivers set to ${count}`);
    await this.pause();
  }

  async configurePopulation() {
    console.log('\n👥 Population Configuration');
    console.log('Sets the population range for each settlement');
    
    const min = await this.promptNumber('Enter minimum population (10-1000): ', 10, 1000);
    if (min === null) return;
    
    const max = await this.promptNumber(`Enter maximum population (${min}-5000): `, min, 5000);
    if (max === null) return;
    
    this.config.populationMin = min;
    this.config.populationMax = max;
    console.log(`✓ Population range set to ${min}-${max}`);
    await this.pause();
  }

  resetDefaults() {
    this.config = {
      worldSize: { width: 100, height: 100 },
      settlements: 5,
      resources: 50,
      rivers: 5,
      populationMin: 50,
      populationMax: 500
    };
  }

  async prompt(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  close() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  async promptNumber(question, min, max) {
    const answer = await this.prompt(question);
    const num = parseInt(answer);
    
    if (isNaN(num)) {
      console.log('❌ Invalid number');
      await this.pause();
      return null;
    }
    
    if (num < min || num > max) {
      console.log(`❌ Number must be between ${min} and ${max}`);
      await this.pause();
      return null;
    }
    
    return num;
  }

  async pause() {
    await this.prompt('\nPress Enter to continue...');
  }
}
