import readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import fs from 'fs';
import path from 'path';
import { Combat } from '../systems/Combat.js';

export class EnhancedGameUI {
  constructor(game) {
    this.game = game;
    this.width = process.stdout.columns || 120;
    this.height = process.stdout.rows || 40;
    this.mode = 'normal';
    this.devMode = false;
    this.messageLog = [];
    this.maxLogSize = 100;
    this.groundItems = new Map(); // Track items on ground by location
    
    this.rl = readline.createInterface({
      input,
      output,
      prompt: '> '
    });

    // Enable raw mode for better control
    if (input.isTTY) {
      input.setRawMode(false);
    }

    if (typeof this.game.registerUIListener === 'function') {
      this._unregisterUI = this.game.registerUIListener((msg, type) => this.log(msg, type || 'system'));
    }
  }

  start() {
    this.clearScreen();
    this.showWelcome();
    this.setupEventHandlers();
    this.startInputLoop();
  }

  setupEventHandlers() {
    process.on('SIGWINCH', () => {
      this.width = process.stdout.columns || 120;
      this.height = process.stdout.rows || 40;
      this.refresh();
    });
  }

  startInputLoop() {
    this.rl.prompt();
    
    this.rl.on('line', (input) => {
      this.handleInput(input.trim());
      this.rl.prompt();
    });
    
    this.rl.on('close', () => {
      this.clearScreen();
      this.log('Goodbye!', 'system');
      process.exit(0);
    });
  }

  clearScreen() {
    console.clear();
    process.stdout.write('\x1b[2J\x1b[0f');
  }

  refresh() {
    if (this.game.player) {
      this.showGameScreen();
    }
  }

  showWelcome() {
    const title = [
      '╔═══════════════════════════════════════════════════════════════════════════════╗',
      '║                                                                               ║',
      '║                    MEDIEVAL LIFE SIMULATION                                   ║',
      '║                  Naturalistic Turn-Based Life Simulator                       ║',
      '║                                                                               ║',
      '╚═══════════════════════════════════════════════════════════════════════════════╝'
    ];
    
    console.log('\n');
    title.forEach(line => console.log(this.center(line)));
    console.log('\n');
    
    const commands = [
      '  Commands:',
      '    start          - Begin a new life',
      '    help           - Show all commands',
      '    quit           - Exit game',
      ''
    ];
    
    commands.forEach(line => console.log(this.center(line)));
    console.log('\n');
  }

  showGameScreen() {
    this.clearScreen();
    
    const player = this.game.getPlayer();
    if (!player) return;
    
    // Draw top border
    this.drawLine('═', '╔', '╗');
    
    // Draw header with world info
    const worldInfo = this.game.getWorldInfo();
    const header = `${player.name} | Age ${Math.floor(player.age)} | ${player.occupation} | ${worldInfo.season} - ${worldInfo.timeOfDay}`;
    this.drawText(header, 'center');
    
    this.drawLine('═', '╠', '╣');
    
    // Main content area - split into panels
    const contentHeight = this.height - 10;
    const leftWidth = Math.floor(this.width * 0.6);
    const rightWidth = this.width - leftWidth - 3;
    
    // Draw main view and status side by side
    for (let i = 0; i < contentHeight; i++) {
      process.stdout.write('║');
      
      if (i === 0) {
        process.stdout.write(this.pad(' LOCATION & SURROUNDINGS', leftWidth));
        process.stdout.write('│');
        process.stdout.write(this.pad(' CHARACTER STATUS', rightWidth));
      } else if (i === 1) {
        process.stdout.write(this.pad('─'.repeat(leftWidth), leftWidth));
        process.stdout.write('│');
        process.stdout.write(this.pad('─'.repeat(rightWidth), rightWidth));
      } else if (i < contentHeight - 8) {
        // Location info on left
        const locationLines = this.getLocationLines();
        const line = locationLines[i - 2] || '';
        process.stdout.write(this.pad(' ' + line, leftWidth));
        process.stdout.write('│');
        
        // Status info on right
        const statusLines = this.getStatusLines();
        const statusLine = statusLines[i - 2] || '';
        process.stdout.write(this.pad(' ' + statusLine, rightWidth));
      } else if (i === contentHeight - 8) {
        process.stdout.write(this.pad('─'.repeat(leftWidth), leftWidth));
        process.stdout.write('│');
        process.stdout.write(this.pad('─'.repeat(rightWidth), rightWidth));
      } else if (i === contentHeight - 7) {
        process.stdout.write(this.pad(' MESSAGE LOG', leftWidth));
        process.stdout.write('│');
        process.stdout.write(this.pad(' QUICK ACTIONS', rightWidth));
      } else if (i === contentHeight - 6) {
        process.stdout.write(this.pad('─'.repeat(leftWidth), leftWidth));
        process.stdout.write('│');
        process.stdout.write(this.pad('─'.repeat(rightWidth), rightWidth));
      } else {
        // Message log on left
        const logIndex = i - (contentHeight - 5);
        const msg = this.messageLog[this.messageLog.length - 5 + logIndex] || '';
        process.stdout.write(this.pad(' ' + msg, leftWidth));
        process.stdout.write('│');
        
        // Quick actions on right
        const actions = ['[W]ork', '[S]leep', '[E]at', '[L]ook', '[M]ove'];
        const action = actions[logIndex] || '';
        process.stdout.write(this.pad(' ' + action, rightWidth));
      }
      
      process.stdout.write('║\n');
    }
    
    // Draw bottom border
    this.drawLine('═', '╚', '╝');
    
    // Command prompt area
    console.log('');
  }

  getLocationLines() {
    const player = this.game.getPlayer();
    if (!player) return [];
    
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const nearby = this.game.kernel.queryEntitiesNear(
      player.position.x, 
      player.position.y, 
      player.position.z, 
      10
    );
    
    const lines = [];
    lines.push(`Biome: ${this.capitalize(tile.biome.type)}`);
    lines.push(`Elevation: ${Math.floor(tile.terrain.elevation)}m`);
    lines.push(`Temperature: ${Math.floor(tile.climate.temperature)}°C`);
    lines.push(`Weather: ${tile.climate.rainfall > 5 ? 'Rainy' : 'Clear'}`);
    lines.push('');
    
    // Show ground items
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length > 0) {
      lines.push('Items on ground:');
      for (const item of groundItems.slice(0, 3)) {
        lines.push(`  • ${item.type}${item.subtype ? ` (${item.subtype})` : ''}`);
      }
      if (groundItems.length > 3) {
        lines.push(`  ... and ${groundItems.length - 3} more`);
      }
      lines.push('');
    }
    
    if (nearby.length > 1) {
      lines.push('Nearby People:');
      let count = 0;
      for (const id of nearby) {
        if (id === player.id || count >= 5) continue;
        const entity = this.game.kernel.entities.get(id);
        if (entity && entity.name) {
          lines.push(`  • ${entity.name} (${entity.occupation || 'person'})`);
          count++;
        }
      }
      if (nearby.length - 1 > count) {
        lines.push(`  ... and ${nearby.length - 1 - count} others`);
      }
    }
    
    if (tile.resources.length > 0) {
      lines.push('');
      lines.push('Resources:');
      for (const res of tile.resources.slice(0, 3)) {
        lines.push(`  • ${this.capitalize(res.type)}: ${res.amount - res.extracted}`);
      }
    }
    
    return lines;
  }

  getStatusLines() {
    const player = this.game.getPlayer();
    if (!player) return [];
    
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    
    const lines = [];
    lines.push(`Health: ${this.getBar(health.overall, 20)} ${(health.overall * 100).toFixed(0)}%`);
    lines.push(`Pain: ${this.getBar(1 - health.pain / 10, 20)} ${health.pain.toFixed(1)}/10`);
    lines.push(`Fatigue: ${this.getBar(1 - health.fatigue, 20)} ${(health.fatigue * 100).toFixed(0)}%`);
    lines.push('');
    lines.push('Needs:');
    lines.push(`  Hunger: ${this.getBar(1 - status.needs.hunger, 15)} ${((1 - status.needs.hunger) * 100).toFixed(0)}%`);
    lines.push(`  Thirst: ${this.getBar(1 - status.needs.thirst, 15)} ${((1 - status.needs.thirst) * 100).toFixed(0)}%`);
    lines.push(`  Sleep: ${this.getBar(1 - status.needs.sleep, 15)} ${((1 - status.needs.sleep) * 100).toFixed(0)}%`);
    lines.push('');
    
    const household = this.game.kernel.entities.get(player.household);
    if (household) {
      lines.push('Household:');
      lines.push(`  Members: ${household.members.length}`);
      lines.push(`  Food: ${household.food.toFixed(0)}`);
      lines.push(`  Wealth: ${household.wealth.toFixed(0)}`);
    }
    
    if (this.devMode) {
      lines.push('');
      lines.push('[DEV MODE]');
      lines.push(`Blood: ${player.physiology.bloodVolume.toFixed(2)}L`);
      lines.push(`Temp: ${player.physiology.bodyTemperature.toFixed(1)}°C`);
      lines.push(`Energy: ${player.physiology.metabolism.energyStores.toFixed(0)} kcal`);
    }
    
    return lines;
  }

  getBar(value, length) {
    const filled = Math.floor(value * length);
    const empty = length - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  handleInput(input) {
    if (!input) return;
    
    const [command, ...args] = input.toLowerCase().split(' ');
    
    const commands = {
      'help': () => this.showHelp(),
      'start': () => this.startNewLife(),
      'look': () => this.look(),
      'l': () => this.look(),
      'status': () => this.showDetailedStatus(),
      'inventory': () => this.showInventory(),
      'i': () => this.showInventory(),
      'move': () => this.move(args),
      'm': () => this.move(args),
      'take': () => this.take(args),
      'get': () => this.take(args),
      'pickup': () => this.take(args),
      'drop': () => this.drop(args),
      'eat': () => this.eat(args),
      'e': () => this.eat(args),
      'drink': () => this.drink(),
      'sleep': () => this.sleep(),
      's': () => this.sleep(),
      'work': () => this.work(),
      'w': () => this.work(),
      'craft': () => this.craft(args),
      'talk': () => this.talk(args),
      'chat': () => this.talk(args),
      'speak': () => this.talk(args),
      'propose': () => this.propose(args),
      'marry': () => this.acceptProposal(args),
      'divorce': () => this.divorce(),
      'family': () => this.showFamily(),
      'adopt': () => this.adoptChild(args),
      'orphans': () => this.listOrphans(),

      'faction': () => this.factionMenu(args),
      'factions': () => this.listFactions(),
      'form-faction': () => this.formFaction(args),
      'join-faction': () => this.joinFaction(args),
      'leave-faction': () => this.leaveFaction(args),
      'alliance': () => this.formAlliance(args),
      'guild': () => this.formGuild(args),

      'declare-war': () => this.declareWar(args),
      'warfare': () => this.warfareStatus(),
      'muster': () => this.musterArmy(args),
      'siege': () => this.startSiege(args),

      'claim-land': () => this.claimLand(args),
      'buy-land': () => this.buyLand(args),
      'sell-land': () => this.sellLand(args),
      'annex-land': () => this.annexLand(args),
      'land': () => this.showLand(args),

      'barter': () => this.barter(args),
      'loan': () => this.loanMenu(args),

      'study': () => this.study(args),
      'apprentice': () => this.startApprenticeship(args),
      'discover': () => this.attemptDiscovery(args),
      'observe': () => this.observePhenomenon(args),
      'languages': () => this.listLanguages(),
      'culture': () => this.showCulture(),
      'convert': () => this.convertReligion(),
      'join-religion': () => this.convertReligion(),
      'recipes': () => this.listRecipes(),
      'cook': () => this.cook(args),
      'cure': () => this.treatDisease(args),
      'infect': () => this.exposeToDisease(args),

      'declare-battle': () => this.declareBattle(args),
      'battle': () => this.battleStatus(args),
      'battle-round': () => this.battleRound(args),
      'march': () => this.marchArmy(args),
      'retreat': () => this.retreatArmy(args),
      'assault': () => this.assaultSiege(args),

      'betray': () => this.betrayFaction(args),
      'scheme': () => this.runScheme(args),
      'spy': () => this.runEspionage(args),
      'coup': () => this.runCoup(args),
      'intrigues': () => this.listIntrigues(),

      'steal': () => this.stealItem(args),
      'accuse': () => this.accusePerson(args),
      'laws': () => this.listLaws(),
      'cases': () => this.listCases(args),
      'enact-law': () => this.enactDynamicLaw(args),

      'titles': () => this.showTitles(),
      'claim-title': () => this.claimTitle(args),
      'grant-title': () => this.grantTitle(args),
      'house': () => this.showHouse(),
      'levy': () => this.raiseLevy(args),
      'court': () => this.holdCourt(),

      'spells': () => this.listSpells(),
      'learn': () => this.learnSpell(args),
      'cast': () => this.castSpell(args),
      'mana': () => this.showMana(),
      'forge': () => this.forgeArtifact(args),
      'shop': () => this.listShops(),
      'browse': () => this.browseShop(args),
      'buy': () => this.buyItem(args),
      'sell': () => this.sellItem(args),
      'haggle': () => this.haggle(args),
      'attack': () => this.attack(args),
      'fight': () => this.attack(args),
      'wait': () => this.wait(args),
      'rest': () => this.wait(args),
      'repay': () => this.repayLoan(args),
      'loans': () => this.listLoans(),

      'gather': () => this.gatherResource(args),
      'harvest': () => this.harvestFlora(args),
      'hunt': () => this.huntAnimal(args),
      'forage': () => this.forage(),
      'plant': () => this.plantCrop(args),
      'gossip': () => this.gossip(args),
      'buy': () => this.buyItem(args),
      'sell': () => this.sellItem(args),

      'mount': () => this.mountHorse(args),
      'dismount': () => this.dismount(),
      'sail': () => this.sailTo(args),
      'drive': () => this.driveCart(args),
      'vehicles': () => this.listVehicles(),
      'stables': () => this.listStables(),
      'travel': () => this.travelTo(args),
      'fast-travel': () => this.fastTravel(args),
      'cargo': () => this.cargoCmd(args),

      'dev': () => this.toggleDevMode(),
      'save': () => this.save(),
      'load': () => this.load(),
      'continue': () => this.continueAsHeir(args),
      'heirs': () => this.listHeirs(),
      'relations': () => this.showRelations(),
      'clear': () => this.clearLog(),
      'refresh': () => this.refresh(),
      'quit': () => this.quit(),
      'exit': () => this.quit()
    };
    
    if (commands[command]) {
      try {
        commands[command]();
      } catch (error) {
        this.log(`Error: ${error.message}`, 'error');
      }
    } else {
      this.log(`Unknown command: ${command}. Type "help" for commands.`, 'error');
    }
  }

  showHelp() {
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                              COMMAND REFERENCE                                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    const categories = {
      'Character': [
        ['start', 'Begin a new life'],
        ['status', 'View detailed character status'],
        ['inventory, i', 'View inventory']
      ],
      'Actions': [
        ['look, l', 'Examine surroundings'],
        ['move <dir>, m', 'Move (north/south/east/west or n/s/e/w)'],
        ['take/get/pickup <item>', 'Pick up item from ground'],
        ['drop <item>', 'Drop item from inventory'],
        ['eat <item>, e', 'Consume food'],
        ['drink', 'Drink water'],
        ['sleep, s', 'Rest and sleep'],
        ['work, w', 'Perform occupation work'],
        ['craft <recipe>', 'Craft item']
      ],
      'Social': [
        ['talk/chat/speak <person>', 'Interact with nearby person'],
        ['propose <person>', 'Propose marriage to someone'],
        ['marry <person>', 'Accept a marriage proposal'],
        ['divorce', 'End your marriage'],
        ['family', 'View your family tree'],
        ['attack/fight <target>', 'Attack target']
      ],
      'Trading': [
        ['shop', 'List nearby shops'],
        ['browse <shop>', 'View shop inventory'],
        ['buy <item> [qty]', 'Purchase item from shop'],
        ['sell <item> [qty]', 'Sell item to shop'],
        ['haggle <item> <price>', 'Negotiate better price']
      ],
      'Natural World': [
        ['gather <resource>', 'Gather natural resources (wood, stone, ore)'],
        ['harvest [plant]', 'Harvest plants, herbs, berries'],
        ['hunt [animal]', 'Hunt wild animals for meat and hide'],
        ['forage', 'Search for edible plants and herbs']
      ],
      'System': [
        ['wait/rest [turns]', 'Pass time (default: 1 turn)'],
        ['dev', 'Toggle developer mode'],
        ['save', 'Save game to file'],
        ['load', 'Load game from file'],
        ['clear', 'Clear message log'],
        ['refresh', 'Refresh screen'],
        ['help', 'Show this help'],
        ['quit, exit', 'Exit game']
      ]
    };
    
    for (const [category, cmds] of Object.entries(categories)) {
      console.log(`\n${category}:`);
      console.log('─'.repeat(80));
      for (const [cmd, desc] of cmds) {
        console.log(`  ${cmd.padEnd(30)} - ${desc}`);
      }
    }
    
    console.log('\n\nPress Enter to continue...');
    this.rl.once('line', () => {
      if (this.game.player) {
        this.showGameScreen();
      } else {
        this.showWelcome();
      }
    });
  }

  startNewLife() {
    if (this.game.player) {
      this.log('You already have an active life.', 'error');
      return;
    }
    
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           CHARACTER CREATION                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    this.rl.question('  Name: ', (name) => {
      this.rl.question('  Sex (male/female): ', (sex) => {
        const result = this.game.createPlayer(name, sex.toLowerCase());
        if (result.success) {
          this.log(`You are born as ${name}, a ${sex} child in ${result.settlement.name}.`, 'success');
          this.log('Your life begins...', 'system');
          this.showGameScreen();
        } else {
          this.log(`Failed to create character: ${result.error}`, 'error');
        }
        this.rl.prompt();
      });
    });
  }

  look() {
    const player = this.game.getPlayer();
    if (!player) {
      this.log('No active character. Use "start" to begin.', 'error');
      return;
    }
    
    this.showGameScreen();
    this.log('You look around carefully.', 'action');
  }

  showDetailedStatus() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.clearScreen();
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║  ${status.name.toUpperCase().padEnd(77)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    console.log(`  Age: ${status.age} years | Sex: ${status.sex} | Occupation: ${status.occupation}\n`);
    
    console.log('  Health Status:');
    console.log(`    Overall Health: ${this.getBar(health.overall, 30)} ${(health.overall * 100).toFixed(0)}%`);
    console.log(`    Pain Level:     ${this.getBar(1 - health.pain / 10, 30)} ${health.pain.toFixed(1)}/10`);
    console.log(`    Fatigue:        ${this.getBar(1 - health.fatigue, 30)} ${(health.fatigue * 100).toFixed(0)}%`);
    console.log(`    Strength:       ${this.getBar(health.strength, 30)} ${(health.strength * 100).toFixed(0)}%\n`);
    
    console.log('  Basic Needs:');
    console.log(`    Hunger: ${this.getBar(1 - status.needs.hunger, 30)} ${((1 - status.needs.hunger) * 100).toFixed(0)}%`);
    console.log(`    Thirst: ${this.getBar(1 - status.needs.thirst, 30)} ${((1 - status.needs.thirst) * 100).toFixed(0)}%`);
    console.log(`    Sleep:  ${this.getBar(1 - status.needs.sleep, 30)} ${((1 - status.needs.sleep) * 100).toFixed(0)}%\n`);
    
    if (player.inventory.items.length > 0) {
      console.log('  Inventory:');
      for (const item of player.inventory.items.slice(0, 10)) {
        console.log(`    • ${item.type}${item.subtype ? ` (${item.subtype})` : ''} [${item.mass}kg]`);
      }
      if (player.inventory.items.length > 10) {
        console.log(`    ... and ${player.inventory.items.length - 10} more items`);
      }
      console.log('');
    }

    // ─── T2-6: Currency display ────────────────────────────────────────
    const ws = this.game.getPlayerWealthSummary();
    if (ws) {
      console.log('  Wealth & Currency:');
      console.log(`    Purse:    ${ws.purse.gold}g ${ws.purse.silver}s ${ws.purse.copper}c  (≈ ${ws.liquidCopper} copper)`);
      console.log(`    Household wealth: ${ws.householdWealth}`);
      console.log(`    Regional currency multiplier: ${ws.regionalCurrency.toFixed(2)}× (settlement #${ws.settlementId})`);
      console.log('');
    }

    console.log('\n  Press Enter to continue...');
    this.rl.once('line', () => {
      this.showGameScreen();
    });
  }

  showInventory() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.log(`Inventory: ${player.inventory.getWeight().toFixed(1)}/${player.inventory.capacity}kg`, 'info');
    if (player.inventory.items.length === 0) {
      this.log('  Empty', 'info');
    } else {
      for (const item of player.inventory.items.slice(0, 5)) {
        this.log(`  • ${item.type}${item.subtype ? ` (${item.subtype})` : ''} [${item.mass}kg]`, 'info');
      }
      if (player.inventory.items.length > 5) {
        this.log(`  ... and ${player.inventory.items.length - 5} more`, 'info');
      }
    }
    this.showGameScreen();
  }

  move(args) {
    const player = this.game.getPlayer();
    if (!player) return;

    const dir = args[0];
    const directions = {
      'north': { x: 0, y: -1 }, 'n': { x: 0, y: -1 },
      'south': { x: 0, y: 1 }, 's': { x: 0, y: 1 },
      'east': { x: 1, y: 0 }, 'e': { x: 1, y: 0 },
      'west': { x: -1, y: 0 }, 'w': { x: -1, y: 0 }
    };

    if (!directions[dir]) {
      this.log('Invalid direction. Use: north/n, south/s, east/e, west/w', 'error');
      return;
    }

    const dx = directions[dir].x;
    const dy = directions[dir].y;
    const traveler = this.game.transportation?.getTraveler?.(player.id);

    // If mounted/on vessel, delegate to transportation.travel so vehicle
    // speed bonuses and condition apply.
    if (traveler && this.game.transportation) {
      const r = this.game.transportation.travel(player, dx, dy);
      if (r?.success) {
        this.game.kernel.entityIndex.update(player);
        this.game.advanceTurns(Math.max(1, r.ticks));
        this.log(`You move ${dir} (${traveler.vehicle ? 'mounted' : 'on foot'}).`, 'action');
        this.showGameScreen();
        return;
      }
    }

    player.position.x += dx;
    player.position.y += dy;
    if (this.game.transportation?._clampPosition) this.game.transportation._clampPosition(player.position);

    this.game.kernel.entityIndex.update(player);
    this.game.advanceTurns(1);

    this.log(`You move ${dir}.`, 'action');
    this.showGameScreen();
  }

  async take(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    
    if (groundItems.length === 0) {
      this.log('There is nothing here to take.', 'error');
      return;
    }
    
    let item;
    
    if (args.length === 0) {
      // Show selection menu
      item = await this.showSelectionMenu(
        groundItems,
        'TAKE WHAT?',
        i => `${i.type}${i.subtype ? ` (${i.subtype})` : ''} [${i.mass}kg]`
      );
      if (!item) return;
    } else {
      const itemName = args.join(' ');
      const itemIndex = groundItems.findIndex(i => 
        i.type.toLowerCase().includes(itemName) || 
        (i.subtype && i.subtype.toLowerCase().includes(itemName))
      );
      
      if (itemIndex === -1) {
        this.log(`There is no "${itemName}" here.`, 'error');
        return;
      }
      
      item = groundItems[itemIndex];
    }
    
    // Check if player can carry it
    if (player.inventory.getWeight() + item.mass > player.inventory.capacity) {
      this.log(`The ${item.type} is too heavy. You're carrying too much.`, 'error');
      return;
    }
    
    // Remove from ground and add to inventory
    const itemIndex = groundItems.indexOf(item);
    groundItems.splice(itemIndex, 1);
    if (groundItems.length === 0) {
      this.groundItems.delete(locKey);
    } else {
      this.groundItems.set(locKey, groundItems);
    }
    
    player.inventory.add(item);
    this.game.advanceTurns(1);
    
    this.log(`You pick up the ${item.type}.`, 'success');
    this.showGameScreen();
  }

  async drop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (player.inventory.items.length === 0) {
      this.log('Your inventory is empty.', 'error');
      return;
    }
    
    let item;
    
    if (args.length === 0) {
      // Show selection menu
      item = await this.showSelectionMenu(
        player.inventory.items,
        'DROP WHAT?',
        i => `${i.type}${i.subtype ? ` (${i.subtype})` : ''} [${i.mass}kg]`
      );
      if (!item) return;
    } else {
      const itemName = args.join(' ');
      item = player.inventory.items.find(i => 
        i.type.toLowerCase().includes(itemName) || 
        (i.subtype && i.subtype.toLowerCase().includes(itemName))
      );
      
      if (!item) {
        this.log(`You don't have any "${itemName}".`, 'error');
        return;
      }
    }
    
    // Remove from inventory
    player.inventory.remove(item.type, 1);
    
    // Add to ground
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    groundItems.push(item);
    this.groundItems.set(locKey, groundItems);
    
    this.game.advanceTurns(1);
    
    this.log(`You drop the ${item.type}.`, 'action');
    this.showGameScreen();
  }

  async talk(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const nearby = this.game.kernel.queryEntitiesNear(
      player.position.x, 
      player.position.y, 
      player.position.z, 
      10
    );
    
    // Get list of nearby people
    const people = [];
    for (const id of nearby) {
      if (id === player.id) continue;
      const entity = this.game.kernel.entities.get(id);
      if (entity && entity.name) {
        people.push(entity);
      }
    }
    
    if (people.length === 0) {
      this.log('There is no one nearby to talk to.', 'error');
      return;
    }
    
    let target;
    
    if (args.length === 0) {
      // Show selection menu
      target = await this.showSelectionMenu(
        people,
        'TALK TO WHOM?',
        p => `${p.name} (${p.occupation})`
      );
      if (!target) return;
    } else {
      const targetName = args.join(' ');
      target = people.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      
      if (!target) {
        this.log(`There is no one named "${targetName}" nearby.`, 'error');
        return;
      }
    }
    
    // Get relationship status — prefer per-person map (source of truth for affinity),
    // fall back to legacy Social.Relationships system if absent.
    const legacyRel = this.game.relationships.getBond(player.id, target.id);
    const personalRel = player.relationships.get(target.id);
    const affinity = personalRel?.affinity ?? legacyRel?.affinity ?? 0;
    const kinship = this.game.kinship.getRelationship(player.id, target.id);

    this.game.advanceTurns(1);

    // Generate conversation based on relationship
    this.log(`You approach ${target.name}.`, 'action');

    if (kinship) {
      this.log(`${target.name}: "Hello, ${kinship}! How are you?"`, 'info');
    } else if (affinity > 0.5) {
      this.log(`${target.name}: "Good to see you, friend!"`, 'info');
    } else if (affinity < -0.5) {
      this.log(`${target.name}: "What do you want?"`, 'info');
    } else {
      this.log(`${target.name}: "Greetings, stranger."`, 'info');
    }

    // Share some information
    const topics = [
      `"The weather has been ${this.game.world.getTile(target.position.x, target.position.y).climate.temperature > 20 ? 'warm' : 'cold'} lately."`,
      `"I work as a ${target.occupation}."`,
      `"Life in ${this.game.world.settlements[0]?.name || 'this place'} is ${this.game.kernel.random() > 0.5 ? 'good' : 'hard'}."`,
      `"Have you heard the news from the market?"`
    ];

    this.log(`${target.name}: ${topics[Math.floor(this.game.kernel.random() * topics.length)]}`, 'info');

    // Update relationships — write to BOTH per-person map (source of truth) and
    // legacy Social.Relationships system so affinity checks via either path agree.
    const nextAffinity = (personalRel?.affinity ?? 0) + 0.1;
    player.relationships.set(target.id, {
      affinity: Math.min(1, nextAffinity),
      trust: personalRel?.trust ?? 0.3,
      respect: personalRel?.respect ?? 0.3
    });
    target.relationships.set(player.id, {
      affinity: Math.min(1, nextAffinity),
      trust: personalRel?.trust ?? 0.3,
      respect: personalRel?.respect ?? 0.3
    });
    // Mirror to legacy system for backwards compatibility.
    if (!legacyRel) {
      this.game.relationships.createBond(player.id, target.id, 0.1);
    } else {
      this.game.relationships.modifyAffinity(player.id, target.id, 0.1);
    }
    // Skill gain: social/persuasion for the player.
    if (player.skills?.train) {
      player.skills.train('persuasion', 'social', 0.5, 1);
    }

    this.showGameScreen();
  }


  async propose(args) {
    const player = this.game.getPlayer();
    if (!player) return;

    // T1-4: refuse for player under marriage age with a clear message.
    if (player.age < 16) {
      this.log(`You are too young to marry (${Math.floor(player.age)} years old). You must be at least 16.`, 'error');
      return;
    }
    if (player.marriage?.spouse) {
      this.log('You are already married.', 'error');
      return;
    }

    const nearby = this.game.kernel.queryEntitiesNear(
      player.position.x,
      player.position.y,
      player.position.z,
      10
    );

    // Get list of nearby eligible people
    const people = [];
    for (const id of nearby) {
      if (id === player.id) continue;
      const entity = this.game.kernel.entities.get(id);
      if (entity && entity.name && entity.age >= 16 && !entity.marriage?.spouse) {
        people.push(entity);
      }
    }

    if (people.length === 0) {
      this.log('There is no one nearby who is eligible to marry.', 'error');
      return;
    }
    
    let target;
    
    if (args.length === 0) {
      // Show selection menu
      target = await this.showSelectionMenu(
        people,
        'PROPOSE TO WHOM?',
        p => `${p.name} (${p.age} years, ${p.sex})`
      );
      if (!target) return;
    } else {
      const targetName = args.join(' ');
      target = people.find(p => p.name.toLowerCase().includes(targetName.toLowerCase()));
      
      if (!target) {
        this.log(`There is no one named "${targetName}" nearby.`, 'error');
        return;
      }
    }
    
    // Attempt proposal
    const result = this.game.marriage.propose(player, target);
    
    this.game.advanceTurns(1);
    
    if (result.success) {
      this.log(result.message, 'success');
      this.log(`You and ${target.name} are now married!`, 'success');
    } else {
      this.log(result.reason, 'error');
    }
    
    this.showGameScreen();
  }

  async acceptProposal(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    // Check for pending proposals
    const proposals = Array.from(this.game.marriage.proposals.values()).filter(
      p => p.target === player.id && p.status === 'pending'
    );
    
    if (proposals.length === 0) {
      this.log('You have no pending marriage proposals.', 'error');
      return;
    }
    
    let proposal;
    
    if (args.length === 0 && proposals.length > 1) {
      // Show selection menu
      const proposers = proposals.map(p => this.game.kernel.entities.get(p.proposer));
      const selected = await this.showSelectionMenu(
        proposers,
        'ACCEPT PROPOSAL FROM WHOM?',
        p => `${p.name} (${p.age} years, ${p.occupation})`
      );
      if (!selected) return;
      proposal = proposals.find(p => p.proposer === selected.id);
    } else if (args.length > 0) {
      const proposerName = args.join(' ');
      proposal = proposals.find(p => {
        const proposer = this.game.kernel.entities.get(p.proposer);
        return proposer && proposer.name.toLowerCase().includes(proposerName.toLowerCase());
      });
      
      if (!proposal) {
        this.log(`No proposal from "${proposerName}".`, 'error');
        return;
      }
    } else {
      proposal = proposals[0];
    }
    
    const proposer = this.game.kernel.entities.get(proposal.proposer);
    const result = this.game.marriage.marry(proposer, player);
    
    this.game.advanceTurns(1);
    
    if (result.success) {
      this.log(result.message, 'success');
    } else {
      this.log(result.reason || 'Marriage failed', 'error');
    }
    
    this.showGameScreen();
  }

  divorce() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (!player.marriage) {
      this.log('You are not married.', 'error');
      return;
    }
    
    const spouse = this.game.kernel.entities.get(player.marriage.spouse);
    if (!spouse) {
      this.log('Cannot find spouse.', 'error');
      return;
    }
    
    this.log(`Are you sure you want to divorce ${spouse.name}? This will damage your relationship.`, 'warning');
    this.rl.question('Type "yes" to confirm: ', (answer) => {
      if (answer.toLowerCase() === 'yes') {
        const result = this.game.marriage.divorce(player, spouse);
        
        this.game.advanceTurns(1);
        
        if (result.success) {
          this.log(result.message, 'success');
        } else {
          this.log(result.reason, 'error');
        }
      } else {
        this.log('Divorce cancelled.', 'info');
      }
      
      this.showGameScreen();
    });
  }

  showFamily() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                              FAMILY TREE                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    const tree = this.game.marriage.getFamilyTree(player);
    
    // Show spouse
    if (tree.spouse) {
      const spouse = this.game.kernel.entities.get(tree.spouse);
      if (spouse) {
        console.log(`  Spouse: ${spouse.name} (${spouse.age} years, ${spouse.occupation})`);
        const marriage = this.game.marriage.marriages.get(player.marriage.marriageId);
        if (marriage) {
          const years = Math.floor((this.game.kernel.turn - marriage.marriedDate) / (365 * 24 * 60 * 60 * 1000));
          console.log(`    Married for ${years} year${years !== 1 ? 's' : ''}`);
        }
      }
    } else {
      console.log('  Spouse: None (unmarried)');
    }
    
    console.log('');
    
    // Show parents
    console.log('  Parents:');
    if (tree.parents.mother) {
      const mother = this.game.kernel.entities.get(tree.parents.mother);
      if (mother) {
        console.log(`    Mother: ${mother.name} (${mother.age} years)`);
      }
    }
    if (tree.parents.father) {
      const father = this.game.kernel.entities.get(tree.parents.father);
      if (father) {
        console.log(`    Father: ${father.name} (${father.age} years)`);
      }
    }
    if (!tree.parents.mother && !tree.parents.father) {
      console.log('    Unknown');
    }
    
    console.log('');
    
    // Show children
    console.log('  Children:');
    if (tree.children.length > 0) {
      for (const childId of tree.children) {
        const child = this.game.kernel.entities.get(childId);
        if (child) {
          console.log(`    ${child.name} (${child.age} years, ${child.sex})`);
        }
      }
    } else {
      console.log('    None');
    }
    
    console.log('');
    
    // Show siblings
    console.log('  Siblings:');
    if (tree.siblings.length > 0) {
      for (const siblingId of tree.siblings) {
        const sibling = this.game.kernel.entities.get(siblingId);
        if (sibling) {
          console.log(`    ${sibling.name} (${sibling.age} years, ${sibling.sex})`);
        }
      }
    } else {
      console.log('    None');
    }
    
    console.log('\n\nPress Enter to continue...');
    this.rl.once('line', () => {
      if (this.game.player) {
        this.showGameScreen();
      }
      this.rl.prompt();
    });
  }

  listShops() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    // Get shops near player
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    
    if (shops.length === 0) {
      this.log('There are no shops nearby.', 'error');
      return;
    }
    
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                              NEARBY SHOPS                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i];
      console.log(`  ${i + 1}. ${shop.name} (${shop.type})`);
      console.log(`     Reputation: ${(shop.reputation * 100).toFixed(0)}%`);
      console.log(`     Wealth: ${shop.wealth} copper\n`);
    }
    
    console.log('\nUse "browse <shop name>" to view inventory');
    console.log('\n\nPress Enter to continue...');
    this.rl.once('line', () => {
      this.showGameScreen();
    });
  }

  async browseShop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    
    if (shops.length === 0) {
      this.log('There are no shops nearby.', 'error');
      return;
    }
    
    let shop;
    
    if (args.length === 0) {
      // Show selection menu
      shop = await this.showSelectionMenu(
        shops,
        'BROWSE WHICH SHOP?',
        s => `${s.name} (${s.type})`
      );
      if (!shop) return;
    } else {
      const shopName = args.join(' ').toLowerCase();
      shop = shops.find(s => s.name.toLowerCase().includes(shopName));
      
      if (!shop) {
        this.log(`Shop "${args.join(' ')}" not found.`, 'error');
        return;
      }
    }
    
    const result = this.game.trading.browseShop(shop.id);
    
    if (!result.success) {
      this.log(result.reason, 'error');
      return;
    }
    
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║  ${shop.name.toUpperCase().padEnd(77)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    if (result.items.length === 0) {
      console.log('  This shop has no items in stock.\n');
    } else {
      console.log('  Available Items:\n');
      for (const item of result.items) {
        console.log(`    ${item.subtype.padEnd(20)} - ${item.price} copper (${item.quantity} in stock)`);
      }
    }
    
    const wealth = this.game.trading.getPersonWealth(player);
    console.log(`\n  Your wealth: ${wealth} copper`);
    console.log('\n  Commands: buy <item>, sell <item>, haggle <item> <price>');
    
    console.log('\n\nPress Enter to continue...');
    this.rl.once('line', () => {
      this.showGameScreen();
    });
  }

  async buyItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length === 0) {
      this.log('Usage: buy <item> [quantity]', 'error');
      return;
    }
    
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    
    if (shops.length === 0) {
      this.log('There are no shops nearby.', 'error');
      return;
    }
    
    // Parse quantity if provided
    let quantity = 1;
    let itemName = args.join(' ');
    
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg)) {
      quantity = parseInt(lastArg);
      itemName = args.slice(0, -1).join(' ');
    }
    
    // Find item in any shop
    let foundShop = null;
    let foundItem = null;
    
    for (const shop of shops) {
      const result = this.game.trading.browseShop(shop.id);
      if (result.success) {
        const item = result.items.find(i => 
          i.subtype.toLowerCase().includes(itemName.toLowerCase())
        );
        if (item) {
          foundShop = shop;
          foundItem = item;
          break;
        }
      }
    }
    
    if (!foundItem) {
      this.log(`Item "${itemName}" not found in any nearby shop.`, 'error');
      return;
    }
    
    const buyResult = this.game.trading.buyItem(
      player,
      foundShop.id,
      foundItem.type,
      foundItem.subtype,
      quantity
    );
    
    this.game.advanceTurns(1);
    
    if (buyResult.success) {
      this.log(buyResult.message, 'success');
    } else {
      this.log(buyResult.reason, 'error');
    }
    
    this.showGameScreen();
  }

  async sellItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length === 0) {
      this.log('Usage: sell <item> [quantity]', 'error');
      return;
    }
    
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    
    if (shops.length === 0) {
      this.log('There are no shops nearby.', 'error');
      return;
    }
    
    // Parse quantity if provided
    let quantity = 1;
    let itemName = args.join(' ');
    
    const lastArg = args[args.length - 1];
    if (!isNaN(lastArg)) {
      quantity = parseInt(lastArg);
      itemName = args.slice(0, -1).join(' ');
    }
    
    // Find item in player inventory
    const item = player.inventory.items.find(i => 
      i.type.toLowerCase().includes(itemName.toLowerCase()) ||
      (i.subtype && i.subtype.toLowerCase().includes(itemName.toLowerCase()))
    );
    
    if (!item) {
      this.log(`You don't have "${itemName}" in your inventory.`, 'error');
      return;
    }
    
    // Sell to first shop (could be improved to find best price)
    const shop = shops[0];
    
    const sellResult = this.game.trading.sellItem(
      player,
      shop.id,
      item.type,
      item.subtype,
      quantity
    );
    
    this.game.advanceTurns(1);
    
    if (sellResult.success) {
      this.log(sellResult.message, 'success');
    } else {
      this.log(sellResult.reason, 'error');
    }
    
    this.showGameScreen();
  }

  async haggle(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length < 2) {
      this.log('Usage: haggle <item> <target price>', 'error');
      return;
    }
    
    const targetPrice = parseInt(args[args.length - 1]);
    if (isNaN(targetPrice)) {
      this.log('Invalid price. Usage: haggle <item> <target price>', 'error');
      return;
    }
    
    const itemName = args.slice(0, -1).join(' ');
    
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    
    if (shops.length === 0) {
      this.log('There are no shops nearby.', 'error');
      return;
    }
    
    // Find item in any shop
    let foundShop = null;
    let foundItem = null;
    
    for (const shop of shops) {
      const result = this.game.trading.browseShop(shop.id);
      if (result.success) {
        const item = result.items.find(i => 
          i.subtype.toLowerCase().includes(itemName.toLowerCase())
        );
        if (item) {
          foundShop = shop;
          foundItem = item;
          break;
        }
      }
    }
    
    if (!foundItem) {
      this.log(`Item "${itemName}" not found in any nearby shop.`, 'error');
      return;
    }
    
    const haggleResult = this.game.trading.haggle(
      player,
      foundShop.id,
      foundItem.type,
      foundItem.subtype,
      targetPrice
    );
    
    this.game.advanceTurns(1);
    
    if (haggleResult.success) {
      this.log(haggleResult.message, 'success');
      this.log(`Original price: ${haggleResult.originalPrice} copper`, 'info');
      this.log(`New price: ${haggleResult.newPrice} copper`, 'success');
    } else {
      this.log(haggleResult.reason || 'Haggling failed', 'error');
    }

    this.showGameScreen();
  }

  async gatherResource(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length === 0) {
      this.log('Usage: gather <resource type>', 'error');
      return;
    }
    
    const resourceType = args.join(' ').toLowerCase();
    const tileKey = `${player.position.x},${player.position.y}`;
    const resources = this.game.naturalWorld.resources.get(tileKey) || [];
    
    // Find matching resource
    const resource = resources.find(r => 
      r.type.toLowerCase().includes(resourceType) ||
      r.subtype.toLowerCase().includes(resourceType)
    );
    
    if (!resource) {
      this.log(`No ${resourceType} found here.`, 'error');
      return;
    }
    
    if (resource.depleted) {
      this.log(`The ${resource.subtype} ${resource.type} is depleted.`, 'error');
      return;
    }
    
    const result = this.game.naturalWorld.harvestResource(resource.id, 5);
    
    if (result.success) {
      // Add to inventory
      if (!player.inventory) {
        player.inventory = { items: [], add: function(item) { this.items.push(item); } };
      }
      
      for (let i = 0; i < result.quantity; i++) {
        player.inventory.add({
          type: result.type,
          subtype: result.subtype,
          quality: result.quality
        });
      }
      
      this.game.advanceTurns(2);
      this.log(`Gathered ${result.quantity}x ${result.subtype} ${result.type}.`, 'success');
      if (player.skills?.train) {
        const skillMap = { wood: ['woodwork', 'crafting'], stone: ['construction', 'crafting'], ore: ['metalwork', 'crafting'] };
        const [skill, cat] = skillMap[result.type] || ['foraging', 'survival'];
        player.skills.train(skill, cat, 0.5, 2);
      }
    } else {
      this.log(result.reason, 'error');
    }

    this.showGameScreen();
  }

  async harvestFlora(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const tileKey = `${player.position.x},${player.position.y}`;
    const floraIds = this.game.naturalWorld.floraByTile.get(tileKey) || [];
    
    if (floraIds.length === 0) {
      this.log('No plants to harvest here.', 'error');
      return;
    }
    
    // Find harvestable plants
    const harvestable = floraIds
      .map(id => this.game.naturalWorld.flora.get(id))
      .filter(f => f && f.harvestable);
    
    if (harvestable.length === 0) {
      this.log('No plants are ready for harvest here.', 'error');
      return;
    }
    
    let plant;
    
    if (args.length === 0) {
      // Show selection menu
      plant = await this.showSelectionMenu(
        harvestable,
        'HARVEST WHICH PLANT?',
        p => `${p.subtype} ${p.type} (${p.growthStage})`
      );
      if (!plant) return;
    } else {
      const plantName = args.join(' ').toLowerCase();
      plant = harvestable.find(p => 
        p.type.toLowerCase().includes(plantName) ||
        p.subtype.toLowerCase().includes(plantName)
      );
      
      if (!plant) {
        this.log(`Plant "${args.join(' ')}" not found or not ready.`, 'error');
        return;
      }
    }
    
    const result = this.game.naturalWorld.harvestFlora(plant.id);
    
    if (result.success) {
      // Add yield to inventory
      if (!player.inventory) {
        player.inventory = { items: [], add: function(item) { this.items.push(item); } };
      }
      
      for (const item of result.yield) {
        for (let i = 0; i < item.quantity; i++) {
          player.inventory.add({
            type: item.type,
            subtype: item.subtype
          });
        }
      }
      
      this.game.advanceTurns(3);

      const yieldDesc = result.yield.map(y => `${y.quantity}x ${y.subtype}`).join(', ');
      this.log(`Harvested ${plant.subtype} ${plant.type}: ${yieldDesc}`, 'success');
      if (player.skills?.train) player.skills.train('foraging', 'survival', 0.5, 3);
    } else {
      this.log(result.reason, 'error');
    }

    this.showGameScreen();
  }

  async huntAnimal(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const tileKey = `${player.position.x},${player.position.y}`;
    const animalIds = this.game.naturalWorld.faunaByTile.get(tileKey) || [];
    
    if (animalIds.length === 0) {
      this.log('No animals to hunt here.', 'error');
      return;
    }
    
    const animals = animalIds
      .map(id => this.game.naturalWorld.fauna.get(id))
      .filter(a => a);
    
    if (animals.length === 0) {
      this.log('No animals found here.', 'error');
      return;
    }
    
    let animal;
    
    if (args.length === 0) {
      // Show selection menu
      animal = await this.showSelectionMenu(
        animals,
        'HUNT WHICH ANIMAL?',
        a => `${a.variant} ${a.species} (${a.size}, ${a.aggressive ? 'aggressive' : 'peaceful'})`
      );
      if (!animal) return;
    } else {
      const animalName = args.join(' ').toLowerCase();
      animal = animals.find(a => 
        a.species.toLowerCase().includes(animalName) ||
        a.variant.toLowerCase().includes(animalName)
      );
      
      if (!animal) {
        this.log(`Animal "${args.join(' ')}" not found here.`, 'error');
        return;
      }
    }
    
    // Get hunting skill
    const huntingSkill = player.skills?.physical?.hunting?.level || 0;
    const skillValue = huntingSkill / 100;
    
    const result = this.game.naturalWorld.huntAnimal(animal.id, skillValue);
    
    if (result.success) {
      // Add yield to inventory
      if (!player.inventory) {
        player.inventory = { items: [], add: function(item) { this.items.push(item); } };
      }
      
      for (const item of result.yield) {
        for (let i = 0; i < item.quantity; i++) {
          player.inventory.add({
            type: item.type,
            subtype: item.subtype
          });
        }
      }
      
      this.game.advanceTurns(5);

      const yieldDesc = result.yield.map(y => `${y.quantity}x ${y.subtype} ${y.type}`).join(', ');
      this.log(`Successfully hunted ${result.species}! Gained: ${yieldDesc}`, 'success');
      if (player.skills?.train) player.skills.train('hunting', 'survival', 0.6, 5);
    } else {
      this.game.advanceTurns(3);
      this.log(result.reason, 'error');
    }

    this.showGameScreen();
  }

  async plantCrop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) {
      this.log('Usage: plant <crop type>', 'error');
      return;
    }
    const cropType = args.join(' ').toLowerCase();
    if (!this.game.agriculture) {
      this.log('Agriculture system not loaded.', 'error');
      return;
    }
    const pos = player.position;
    const tileKey = `${pos?.x ?? 0},${pos?.y ?? 0}`;
    const tile = this.game.world?.tiles?.get?.(tileKey);
    if (!tile) {
      this.log('No tilled field here. Look for arable land.', 'error');
      return;
    }
    const result = this.game.agriculture.plant
      ? this.game.agriculture.plant(pos.x, pos.y, cropType)
      : { success: false, reason: 'Agriculture.plant() not implemented' };
    if (result.success) {
      this.game.advanceTurns(30);
      this.log(`Planted ${cropType} at (${pos.x}, ${pos.y}).`, 'success');
    } else {
      this.log(result.reason || `Could not plant ${cropType}.`, 'error');
    }
    this.showGameScreen();
  }

  async gossip(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const peer = this.game.kernel.queryEntitiesNear(player.position?.x ?? 0, player.position?.y ?? 0, 0, 10)
      .map(id => this.game.kernel.entities.get(id))
      .find(p => p && p !== player && p.alive && p.age >= 12 && p.name);
    if (!peer) {
      this.log('No one nearby to gossip with.', 'error');
      return;
    }
    if (!this.game.reputation?.makeClaim) {
      this.log('Reputation system not available.', 'error');
      return;
    }
    const subject = args.length > 0
      ? this.game.kernel.entities.get(parseInt(args[0], 10))
      : this.game.kernel.alivePeople && Array.from(this.game.kernel.alivePeople).find(p => p && p !== player && p !== peer);
    if (!subject) {
      this.log('Usage: gossip [subjectId]', 'error');
      return;
    }
    const claim = this.game.reputation.makeClaim(player, subject, 'honest', 0.6 + this.game.kernel.random() * 0.2, { type: 'witnessed' });
    if (claim) {
      const result = this.game.reputation.propagateClaim(claim.id, player, peer, { medium: 'conversation' });
      if (result.success) {
        this.game.advanceTurns(5);
        this.log(`You gossip with ${peer.name} about ${subject.name}. They ${result.believed ? 'believe' : 'doubt'} you.`, 'success');
      } else {
        this.log(`${peer.name} doesn't buy it: ${result.reason}`, 'error');
      }
    }
    this.showGameScreen();
  }

  async buyItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (!this.game.trading) { this.log('Trading system not available.', 'error'); return; }
    const settlementId = player.position?.settlementId;
    const shop = this.game.trading.shops && Array.from(this.game.trading.shops.values()).find(s => s && s.settlementId === settlementId);
    if (!shop) { this.log('No shop here.', 'error'); return; }
    const good = (args[0] || '').toLowerCase();
    const stock = Array.from(shop.inventory?.keys?.() || []);
    const found = stock.find(k => k.toLowerCase().includes(good));
    if (!found) { this.log(`Shop has no ${good || 'matching goods'}.`, 'error'); return; }
    const [itemType, itemSubtype] = found.split('_');
    const result = this.game.trading.buyItem(player, shop.id, itemType, itemSubtype, 1);
    if (result?.success) {
      this.game.advanceTurns(2);
      this.log(`Bought 1× ${found} for ${result.cost ?? '?'}.`, 'success');
    } else {
      this.log(result?.reason || 'Cannot buy that.', 'error');
    }
    this.showGameScreen();
  }

  async sellItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (!this.game.trading) { this.log('Trading system not available.', 'error'); return; }
    const settlementId = player.position?.settlementId;
    const shop = this.game.trading.shops && Array.from(this.game.trading.shops.values()).find(s => s && s.settlementId === settlementId);
    if (!shop) { this.log('No shop here.', 'error'); return; }
    const good = (args[0] || '').toLowerCase();
    const have = (player.inventory?.items || []).find(i => i && (i.type === good || i.subtype === good || (i.name || '').toLowerCase().includes(good)));
    if (!have) { this.log(`You have no ${good || 'sellable goods'}.`, 'error'); return; }
    const result = this.game.trading.sellItem(player, shop.id, have.type, have.subtype || '', 1);
    if (result.success) {
      this.game.advanceTurns(2);
      this.log(`Sold 1× ${have.name || have.type || 'item'} for ${result.cost ?? '?'}.`, 'success');
    } else {
      this.log(result.reason || 'Cannot sell that.', 'error');
    }
    this.showGameScreen();
  }

  forage() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const tileKey = `${player.position.x},${player.position.y}`;
    
    // Check for berries, herbs, mushrooms
    const floraIds = this.game.naturalWorld.floraByTile.get(tileKey) || [];
    const forageable = floraIds
      .map(id => this.game.naturalWorld.flora.get(id))
      .filter(f => f && f.harvestable && 
        (f.type === 'herb' || f.type === 'mushroom' || f.type === 'bush'));
    
    if (forageable.length === 0) {
      this.log('Nothing to forage here.', 'error');
      return;
    }
    
    // Forage random items
    const found = [];
    for (const plant of forageable) {
      if (this.game.kernel.random() < 0.5) {
        const result = this.game.naturalWorld.harvestFlora(plant.id);
        if (result.success) {
          found.push(...result.yield);
        }
      }
    }
    
    if (found.length === 0) {
      this.log('You foraged but found nothing useful.', 'info');
    } else {
      // Add to inventory
      if (!player.inventory) {
        player.inventory = { items: [], add: function(item) { this.items.push(item); } };
      }
      
      for (const item of found) {
        for (let i = 0; i < item.quantity; i++) {
          player.inventory.add({
            type: item.type,
            subtype: item.subtype
          });
        }
      }
      
      const foundDesc = found.map(f => `${f.quantity}x ${f.subtype}`).join(', ');
      this.log(`Foraged: ${foundDesc}`, 'success');
      if (player.skills?.train) player.skills.train('foraging', 'survival', 0.6, 4);
    }

    this.game.advanceTurns(4);
    this.showGameScreen();
  }

  async eat(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    // Find food items
    const foodItems = player.inventory.items.filter(i => 
      i.type === 'food' || i.subtype === 'food' || i.nutrition
    );
    
    if (foodItems.length === 0) {
      this.log('You don\'t have any food.', 'error');
      return;
    }
    
    let food;
    
    if (args.length === 0) {
      // Show selection menu
      food = await this.showSelectionMenu(
        foodItems,
        'EAT WHAT?',
        i => `${i.type}${i.nutrition ? ` (${i.nutrition} kcal)` : ''}`
      );
      if (!food) return;
    } else {
      const itemType = args.join(' ');
      food = foodItems.find(i => 
        i.type.toLowerCase().includes(itemType) || 
        (i.subtype && i.subtype.toLowerCase().includes(itemType))
      );
      
      if (!food) {
        this.log(`You don't have any ${itemType}.`, 'error');
        return;
      }
    }
    
    player.physiology.consume(food);
    player.inventory.remove(food.type, 1);
    player.needs.satisfy('hunger', 0.5);
    
    this.game.advanceTurns(1);
    this.log(`You eat the ${food.type}.`, 'action');
    this.showGameScreen();
  }

  drink() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    player.physiology.drink({ volume: 0.5, contaminated: this.game.kernel.random() < 0.1 });
    player.needs.satisfy('thirst', 0.6);
    
    this.game.advanceTurns(1);
    this.log('You drink some water.', 'action');
    this.showGameScreen();
  }

  sleep() {
    const player = this.game.getPlayer();
    if (!player) return;

    this.log('You sleep...', 'action');
    this.game.advanceTurns(8);

    player.needs.satisfy('sleep', 1.0);
    player.physiology.fatigue = 0;
    
    this.log('You wake up refreshed.', 'success');
    this.showGameScreen();
  }

  work() {
    const player = this.game.getPlayer();
    if (!player) return;

    this.log(`You work as a ${player.occupation}...`, 'action');
    this.game.advanceTurns(8);

    const household = this.game.kernel.entities.get(player.household);
    if (household) {
      const productivity = player.skills.knowledge.agriculture * player.physiology.getHealthStatus().strength;
      household.addWealth(productivity * 10);
      household.food += productivity * 5;
      this.log(`Earned ${(productivity * 10).toFixed(0)} wealth for household.`, 'success');
    }
    // T1-6: Player skill gain on work.
    if (player.skills?.train) {
      const occSkill = {
        peasant: ['agriculture', 'knowledge'],
        craftsman: ['woodwork', 'crafting'],
        merchant: ['trading', 'social'],
        soldier: ['melee', 'combat'],
        priest: ['teaching', 'social'],
        apprentice: ['woodwork', 'crafting']
      }[player.occupation] || ['agriculture', 'knowledge'];
      player.skills.train(occSkill[0], occSkill[1], 0.5, 8);
    }
    this.showGameScreen();
  }

  craft(args) {
    const player = this.game.getPlayer();
    if (!player) return;

    const recipe = args.join(' ');
    const result = this.game.crafting.craft(player, recipe, player.inventory, this.game.kernel);

    if (result.success) {
      this.log(`Crafting ${recipe}... (${result.turnsRequired} turns)`, 'action');
      this.game.advanceTurns(result.turnsRequired);
      player.inventory.add(result.item);
      this.log(`Crafted ${result.item.type}!`, 'success');
      // T1-6: Player skill gain on craft.
      if (player.skills?.train) {
        const recipeSkill = {
          tool: ['metalwork', 'crafting'],
          weapon: ['metalwork', 'crafting'],
          clothing: ['textiles', 'crafting'],
          shelter: ['construction', 'crafting'],
          food: ['foraging', 'survival']
        }[recipe] || ['woodwork', 'crafting'];
        player.skills.train(recipeSkill[0], recipeSkill[1], 0.6, result.turnsRequired);
      }
    } else {
      this.log(`Cannot craft: ${result.reason}`, 'error');
    }
    this.showGameScreen();
  }

  async attack(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 5);
    const people = nearby.map(id => this.game.kernel.entities.get(id)).filter(e => e && e.name && e.id !== player.id);
    
    if (people.length === 0) {
      this.log('There is no one nearby to attack.', 'error');
      return;
    }
    
    let target;
    
    if (args.length === 0) {
      // Show selection menu
      target = await this.showSelectionMenu(
        people,
        'ATTACK WHOM?',
        p => `${p.name} (${p.occupation})`
      );
      if (!target) return;
    } else {
      const targetName = args.join(' ');
      target = people.find(e => e.name.toLowerCase().includes(targetName.toLowerCase()));
      
      if (!target) {
        this.log('Target not found nearby.', 'error');
        return;
      }
    }
    
    const weapon = player.inventory.find(i => i.type === 'weapon');
    const result = Combat.resolveAttack(player, target, weapon, 'torso', this.game.kernel);
    
    this.game.advanceTurns(1);
    
    if (result.hit) {
      this.log(`You hit ${target.name} in the ${result.location}! Damage: ${(result.damage * 100).toFixed(0)}%`, 'combat');
      if (!target.physiology.checkVitals().alive && target.alive) {
        target.die('combat', this.game.kernel);
        this.log(`${target.name} has died!`, 'combat');
      }
    } else {
      this.log(`You miss ${target.name}.`, 'combat');
    }
    this.showGameScreen();
  }

  wait(args) {
    const turns = parseInt(args[0]) || 1;
    this.game.advanceTurns(turns);
    this.log(`${turns} turn(s) pass...`, 'action');
    this.showGameScreen();
  }

  toggleDevMode() {
    this.devMode = !this.devMode;
    this.log(`Developer mode: ${this.devMode ? 'ON' : 'OFF'}`, 'system');
    if (this.game.player) {
      this.showGameScreen();
    }
  }

  continueAsHeir(args) {
    const player = this.game.getPlayer();
    if (player && player.alive) {
      this.log('Your character is still alive.', 'error');
      return;
    }
    const idx = parseInt(args[0]) || 0;
    const result = this.game.continueAsHeir(idx);
    if (result.success) {
      this.log(`You are now ${result.player.name} (age ${Math.floor(result.player.age)}).`, 'success');
      this.showGameScreen();
    } else {
      this.log(`Cannot continue: ${result.error}`, 'error');
    }
  }

  listHeirs() {
    const player = this.game.getPlayer();
    if (player && player.alive) {
      this.log('You are still alive.', 'error');
      return;
    }
    if (!this.game.kinship) {
      this.log('No kinship data available.', 'error');
      return;
    }
    const deadId = this.game.player?.id;
    const heirs = this.game.kinship.getEligibleHeirs(deadId).filter(id => {
      const h = this.game.kernel.entities.get(id);
      return h && h.alive && h.canSucceed();
    });
    if (heirs.length === 0) {
      this.log('No eligible heirs remain.', 'error');
      this.log('Your lineage has ended. Use "start" to begin a new life.', 'system');
      return;
    }
    this.log('Eligible heirs:', 'system');
    for (let i = 0; i < heirs.length; i++) {
      const h = this.game.kernel.entities.get(heirs[i]);
      this.log(`  ${i + 1}. ${h.name} (age ${Math.floor(h.age)}, ${h.occupation})`, 'info');
    }
    this.log('Use "continue <number>" to play as an heir.', 'system');
  }

  showRelations() {
    const player = this.game.getPlayer();
    if (!player) return;
    const nearby = this.game.kernel.queryEntitiesNear(
      player.position.x, player.position.y, player.position.z, 10
    );
    this.log('Nearby relationships:', 'system');
    let count = 0;
    for (const id of nearby) {
      if (id === player.id) continue;
      const entity = this.game.kernel.entities.get(id);
      if (!entity || !entity.name) continue;
      const bond = this.game.relationships.getBond(player.id, id);
      const kinship = this.game.kinship.getRelationship(player.id, id);
      const label = kinship || (bond && bond.affection > 0.5 ? 'friend' : 'stranger');
      this.log(`  ${entity.name}: ${label} (affinity: ${bond ? bond.affection.toFixed(2) : 'n/a'})`, 'info');
      count++;
      if (count >= 10) break;
    }
  }

  save() {
    try {
      const saveData = this.game.save();
      const saveDir = path.join(process.cwd(), 'saves');
      
      // Create saves directory if it doesn't exist
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `save_${this.game.player?.name || 'unknown'}_${timestamp}.json`;
      const filepath = path.join(saveDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2));
      
      this.log(`Game saved to: ${filename}`, 'success');
      if (this.devMode) {
        this.log(`[DEV] Save size: ${JSON.stringify(saveData).length} bytes`, 'system');
        this.log(`[DEV] Full path: ${filepath}`, 'system');
      }
    } catch (error) {
      this.log(`Failed to save game: ${error.message}`, 'error');
    }
  }

  load() {
    try {
      const saveDir = path.join(process.cwd(), 'saves');
      
      if (!fs.existsSync(saveDir)) {
        this.log('No saves directory found. Save a game first.', 'error');
        return;
      }
      
      const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
      
      if (files.length === 0) {
        this.log('No save files found.', 'error');
        return;
      }
      
      this.clearScreen();
      console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                              LOAD GAME                                        ║');
      console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
      
      console.log('Available saves:\n');
      files.forEach((file, index) => {
        const stats = fs.statSync(path.join(saveDir, file));
        console.log(`  ${index + 1}. ${file}`);
        console.log(`     Modified: ${stats.mtime.toLocaleString()}`);
        console.log(`     Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
      });
      
      this.rl.question('Enter save number to load (or press Enter to cancel): ', (answer) => {
        const choice = parseInt(answer);
        
        if (isNaN(choice) || choice < 1 || choice > files.length) {
          this.log('Load cancelled.', 'system');
          if (this.game.player) {
            this.showGameScreen();
          } else {
            this.showWelcome();
          }
          this.rl.prompt();
          return;
        }
        
        const filename = files[choice - 1];
        const filepath = path.join(saveDir, filename);
        
        try {
          const saveData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          const result = this.game.load(saveData);
          
          if (result.success) {
            this.log(`Game loaded from: ${filename}`, 'success');
            this.showGameScreen();
          } else {
            this.log(`Failed to load game: ${result.error}`, 'error');
          }
        } catch (error) {
          this.log(`Failed to load game: ${error.message}`, 'error');
        }
        
        this.rl.prompt();
      });
    } catch (error) {
      this.log(`Failed to load game: ${error.message}`, 'error');
    }
  }

  clearLog() {
    this.messageLog = [];
    this.log('Message log cleared.', 'system');
    if (this.game.player) {
      this.showGameScreen();
    }
  }

  // ─── Adoption ──────────────────────────────────────────────────────

  listOrphans() {
    const player = this.game.getPlayer();
    if (!player) return;
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    if (orphans.length === 0) {
      this.log('No orphans nearby (within 20 tiles).', 'info');
      return;
    }
    this.log(`Orphans nearby (${orphans.length}):`, 'system');
    for (let i = 0; i < orphans.length; i++) {
      this.log(`  ${i + 1}. ${orphans[i].name} (age ${Math.floor(orphans[i].age)}, ${orphans[i].sex})`, 'info');
    }
    this.log('Use "adopt <number>" to adopt one.', 'system');
  }

  async adoptChild(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (player.age < 18) {
      this.log('You must be at least 18 to adopt.', 'error');
      return;
    }
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    if (orphans.length === 0) {
      this.log('No orphans nearby to adopt.', 'error');
      return;
    }
    let child;
    if (args.length === 0) {
      child = await this.showSelectionMenu(orphans, 'ADOPT WHOM?', c => `${c.name} (age ${Math.floor(c.age)}, ${c.sex})`);
      if (!child) return;
    } else {
      const num = parseInt(args[0]);
      if (!isNaN(num) && num >= 1 && num <= orphans.length) {
        child = orphans[num - 1];
      } else {
        const name = args.join(' ').toLowerCase();
        child = orphans.find(c => c.name.toLowerCase().includes(name));
      }
      if (!child) { this.log(`No orphan matching "${args.join(' ')}".`, 'error'); return; }
    }
    const result = this.game.marriage.adopt(player, child);
    this.game.advanceTurns(1);
    if (result.success) {
      this.log(`You have adopted ${child.name}. They are now part of your household.`, 'success');
    } else {
      this.log(`Adoption failed: ${result.reason}`, 'error');
    }
    this.showGameScreen();
  }

  // ─── Factions / Alliances / Guilds ─────────────────────────────────

  listFactions() {
    const factions = this.game.factions?.factions;
    if (!factions || factions.size === 0) {
      this.log('No factions exist yet. Use "form-faction <name>" to create one.', 'system');
      return;
    }
    this.log('Known factions:', 'system');
    for (const [, f] of factions) {
      const leader = this.game.kernel.entities.get(f.leader);
      this.log(`  ${f.id}. ${f.name} [${f.purpose}] — ${f.members.length} members, led by ${leader?.name || '?'}`, 'info');
    }
    const alliances = this.game.factions.alliances;
    if (alliances.size > 0) {
      this.log('\nActive alliances:', 'system');
      for (const [, a] of alliances) this.log(`  Alliance ${a.id}: ${(a.members || []).join(', ')}`, 'info');
    }
  }

  formFaction(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) {
      this.log('Usage: form-faction <name> [purpose]', 'error');
      this.log('  purposes: political, economic, religious, military, social, guild, business', 'info');
      return;
    }
    const purpose = ['guild', 'business'].includes(args[args.length - 1].toLowerCase())
      ? args[args.length - 1].toLowerCase()
      : 'social';
    const name = purpose === 'guild' || purpose === 'business'
      ? args.slice(0, -1).join(' ')
      : args.join(' ');
    const result = this.game.factions.createFaction(name, player, purpose, { economic: 0.5, social: 0.5, religious: 0.5, political: 0.5 });
    this.game.advanceTurns(1);
    if (result.success) {
      this.log(`Faction "${name}" founded as a ${purpose} group. You are its leader.`, 'success');
    }
  }

  formGuild(args) {
    args.unshift('guild');
    this.formFaction(args);
  }

  joinFaction(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const id = parseInt(args[0]);
    if (isNaN(id)) { this.log('Usage: join-faction <id>', 'error'); return; }
    const result = this.game.factions.join(id, player, 'voluntary');
    this.game.advanceTurns(1);
    if (result.success) this.log(`Joined faction ${id} (fit: ${result.fit.toFixed(2)}).`, 'success');
    else this.log(`Cannot join: ${result.reason}`, 'error');
  }

  leaveFaction(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const id = parseInt(args[0]);
    if (isNaN(id)) { this.log('Usage: leave-faction <id>', 'error'); return; }
    const result = this.game.factions.leave(id, player.id, 'voluntary');
    this.game.advanceTurns(1);
    if (result.success) this.log(`Left faction ${id}.`, 'success');
    else this.log(`Cannot leave: ${result.reason}`, 'error');
  }

  formAlliance(args) {
    if (args.length < 2) { this.log('Usage: alliance <factionId1> <factionId2>', 'error'); return; }
    const id1 = parseInt(args[0]); const id2 = parseInt(args[1]);
    if (this.game.factions.formAlliance) {
      const result = this.game.factions.formAlliance(id1, id2);
      if (result?.success) this.log(`Alliance formed between ${id1} and ${id2}.`, 'success');
      else this.log(`Alliance failed: ${result?.reason || 'unknown'}`, 'error');
    } else {
      // Fallback: create manually
      const id = (this.game.factions.nextAllianceId = (this.game.factions.nextAllianceId || 1) + 1) - 1;
      this.game.factions.alliances.set(id, { id, members: [id1, id2], formed: this.game.kernel.turn });
      this.log(`Alliance ${id} formed between factions ${id1} and ${id2}.`, 'success');
    }
  }

  factionMenu(args) {
    if (args.length === 0) { this.listFactions(); return; }
    const sub = args[0];
    if (sub === 'list') this.listFactions();
    else this.log(`Unknown faction subcommand: ${sub}`, 'error');
  }

  // ─── Warfare ────────────────────────────────────────────────────────

  musterArmy(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const size = parseInt(args[0]) || 10;
    const settlement = this.game.world.settlements[player.position?.settlementId ?? 0];
    if (!settlement) { this.log('You must be in a settlement to muster troops.', 'error'); return; }
    const soldiers = [];
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50);
    for (const id of nearby) {
      const p = this.game.kernel.entities.get(id);
      if (p && p.alive && p.age >= 16 && p !== player) {
        soldiers.push(p);
        if (soldiers.length >= size) break;
      }
    }
    if (soldiers.length === 0) { this.log('No one nearby will follow you to war.', 'error'); return; }
    const army = this.game.warfare.musterArmy(player, soldiers, { x: player.position.x, y: player.position.y });
    this.game.advanceTurns(60);
    this.log(`Army ${army.id} mustered at (${player.position.x},${player.position.y}) — ${soldiers.length} soldiers, supplies for 7 days.`, 'success');
  }

  declareWar(args) {
    if (args.length < 2) { this.log('Usage: declare-war <factionId> <factionId> [justification]', 'error'); return; }
    const id1 = parseInt(args[0]); const id2 = parseInt(args[1]);
    const justification = args.slice(2).join(' ') || 'Unspecified';
    const result = this.game.factions.declareWar
      ? this.game.factions.declareWar(id1, id2, justification)
      : { success: true, conflict: { id: (this.game.factions.nextConflictId = (this.game.factions.nextConflictId || 1) + 1) - 1, parties: [id1, id2], justification, declared: this.game.kernel.turn } };
    this.game.factions.conflicts.set(result.conflict.id, result.conflict);
    this.game.advanceTurns(60);
    this.log(`War declared between factions ${id1} and ${id2}: "${justification}"`, 'combat');
  }

  warfareStatus() {
    const battles = this.game.warfare.battles;
    const sieges = this.game.warfare.sieges;
    const armies = this.game.warfare.armies;
    const conflicts = this.game.factions.conflicts;
    this.log(`⚔  Warfare status: ${armies.size} armies, ${battles.size} battles, ${sieges.size} sieges, ${conflicts.size} active wars`, 'system');
    for (const [, c] of conflicts) this.log(`  War ${c.id}: parties ${(c.parties || []).join(' vs ')} — "${c.justification || ''}"`, 'combat');
    for (const [, a] of armies) this.log(`  Army ${a.id}: ${a.soldiers.length} soldiers, morale ${a.morale.toFixed(2)}, supplies food=${a.supplies.food}`, 'info');
  }

  startSiege(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const targetSettlement = parseInt(args[0]);
    const siege = this.game.warfare.initiateSiege
      ? this.game.warfare.initiateSiege(player.id, targetSettlement)
      : { id: (this.game.warfare.nextSiegeId = (this.game.warfare.nextSiegeId || 1) + 1) - 1, attacker: player.id, target: targetSettlement, started: this.game.kernel.turn };
    this.game.warfare.sieges.set(siege.id, siege);
    this.game.advanceTurns(60);
    this.log(`Siege ${siege.id} begun against settlement ${targetSettlement}.`, 'combat');
  }

  // ─── Land Ownership ────────────────────────────────────────────────

  claimLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: claim-land <x> <y> [justification]', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const justification = args.slice(2).join(' ') || 'Claim by right of presence';
    const result = this.game.landOwnership.registerClaim(x, y, player, justification);
    this.game.advanceTurns(1);
    if (result.success) this.log(`Claim filed on (${x},${y}): "${justification}"`, 'success');
    else this.log(`Claim failed: ${result.reason}`, 'error');
  }

  buyLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: buy-land <x> <y>', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const sid = player.position?.settlementId ?? 0;
    const price = this.game.landOwnership.getLandPrice(x, y, sid);
    if (price === null) { this.log('No parcel at that location.', 'error'); return; }
    const result = this.game.landOwnership.buyLand(x, y, player, price);
    this.game.advanceTurns(1);
    if (result.success) this.log(`Purchased (${x},${y}) for ${price} copper. Area currency multiplier: ${(this.game.landOwnership.regionalCurrency.get(sid) ?? 1).toFixed(2)}`, 'success');
    else this.log(`Purchase failed: ${result.reason}`, 'error');
  }

  sellLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: sell-land <x> <y>', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const result = this.game.landOwnership.sellLand(x, y, player);
    this.game.advanceTurns(1);
    if (result.success) this.log(`Released (${x},${y}) back to the common pool.`, 'success');
    else this.log(`Sell failed: ${result.reason}`, 'error');
  }

  annexLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: annex-land <x> <y> [militaryPower]', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const power = parseInt(args[2]) || 10;
    const result = this.game.landOwnership.annexLand(x, y, player, power);
    this.game.advanceTurns(60);
    if (result.success) {
      this.log(`⚔ Annexed (${x},${y}).`, 'combat');
      if (result.contest) this.log(`  Contest: attacker ${result.contest.attackerPower} vs defender ${result.contest.defenderPower}`, 'combat');
    } else this.log(`Annexation failed: ${result.reason}`, 'error');
  }

  showLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const x = args[0] ? parseInt(args[0]) : player.position.x;
    const y = args[1] ? parseInt(args[1]) : player.position.y;
    const parcel = this.game.landOwnership.getParcel(x, y);
    if (!parcel) {
      this.log(`No parcel registered at (${x},${y}).`, 'info');
      return;
    }
    const owner = parcel.owner;
    let ownerLabel = 'unclaimed';
    if (typeof owner === 'number') {
      const ent = this.game.kernel.entities.get(owner);
      ownerLabel = ent ? ent.name : `person #${owner}`;
    } else if (typeof owner === 'string') {
      ownerLabel = owner;
    }
    this.log(`Land (${x},${y}): value=${parcel.value}, improvements=${parcel.improvements}, owner=${ownerLabel}`, 'info');
    const sid = player.position?.settlementId ?? 0;
    this.log(`  Local price: ${this.game.landOwnership.getLandPrice(x, y, sid)} copper (currency ×${(this.game.landOwnership.regionalCurrency.get(sid) ?? 1).toFixed(2)})`, 'info');
  }

  // ─── Bartering & Credit ────────────────────────────────────────────

  async barter(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: barter <person> <yourItem>=<theirItem>', 'error'); return; }
    const targetName = args[0];
    const trade = args.slice(1).join(' ');
    const m = trade.match(/^([a-z]+)=([a-z]+)$/i);
    if (!m) { this.log('Trade format: <yourItem>=<theirItem>, e.g. "barter John food=wood"', 'error'); return; }
    const myItem = m[1].toLowerCase();
    const theirItem = m[2].toLowerCase();
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(targetName.toLowerCase()) && p !== player);
    if (!target) { this.log(`No one named "${targetName}" nearby.`, 'error'); return; }
    const result = this.game.trading.barter(player, target, myItem, theirItem);
    this.game.advanceTurns(1);
    if (result.success) this.log(result.message, 'success');
    else this.log(`Barter refused: ${result.reason}`, 'error');
  }

  loanMenu(args) {
    const sub = args[0];
    if (sub === 'take') {
      const amount = parseInt(args[1]) || 100;
      const lender = { id: -1, wealth: 999999 }; // the moneylender abstraction
      const result = this.game.credit.issueLoan(lender, this.game.player, amount, { duration: 365, interestRate: 0.1, collateralRequired: false });
      if (result.success) this.log(`Loan ${result.loan.id} issued: ${amount} copper, repay ${result.totalRepayment} over 1 year.`, 'success');
      else this.log(`Loan denied: ${result.reason}`, 'error');
    } else {
      this.log('Usage: loan take <amount>', 'error');
    }
  }

  // ─── T2-7: per-loan repay command (separate from `loan take`) ────────
  repayLoan(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: repay <loanId> <amount>', 'error'); return; }
    const loanId = parseInt(args[0], 10);
    const amount = parseInt(args[1], 10);
    if (isNaN(loanId) || isNaN(amount) || amount <= 0) { this.log('Bad loan id or amount.', 'error'); return; }
    const r = this.game.credit.makePayment(loanId, player, amount);
    this.game.advanceTurns(1);
    if (r.success) this.log(`Repaid ${amount} on loan #${loanId}. Balance: ${Math.floor(r.remainingBalance)}${r.fullyRepaid ? ' (cleared)' : ''}.`, 'success');
    else this.log(`Repay failed: ${r.reason}`, 'error');
  }

  listLoans() {
    const player = this.game.getPlayer();
    if (!player) return;
    const loans = this.game.credit.getActiveLoansForPerson(player.id);
    if (!loans.length) { this.log('No active loans.', 'info'); return; }
    for (const l of loans) {
      this.log(`  #${l.id}: principal ${l.principal}, balance ${Math.floor(l.balance)}, ${(l.interestRate*100).toFixed(1)}%/yr, due in ${l.duration}d`, 'info');
    }
    this.log('Use "repay <id> <amount>" to pay down a loan.', 'system');
  }

  // ─── Education / Knowledge / Technology ─────────────────────────────

  study(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: study <subject> [hours]', 'error'); this.log('  Subjects: agriculture, medicine, metallurgy, masonry, literacy, law, warfare, navigation', 'info'); return; }
    const subject = args[0];
    const hours = parseInt(args[1]) || 4;
    const result = this.game.education.selfStudy(player, subject, hours, ['basic_tools']);
    this.game.advanceTurns(hours * 60);
    if (result?.success !== false) this.log(`Studied ${subject} for ${hours} hours.`, 'success');
    else this.log(`Could not study: ${result?.reason || 'unknown'}`, 'error');
  }

  startApprenticeship(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) { this.log('Usage: apprentice <master> <craft> [years]', 'error'); return; }
    const masterName = args[0];
    const craft = args[1];
    const years = parseInt(args[2]) || 3;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const master = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(masterName.toLowerCase()) && p !== player && p.age >= 18);
    if (!master) { this.log(`No adult named "${masterName}" nearby.`, 'error'); return; }
    const result = this.game.education.createApprenticeship(master, player, craft, years * 365);
    this.game.advanceTurns(60);
    if (result?.success !== false) this.log(`Apprenticed to ${master.name} for ${years} years learning ${craft}.`, 'success');
    else this.log(`Apprenticeship failed: ${result?.reason || 'unknown'}`, 'error');
  }

  attemptDiscovery(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: discover <technology> [approach]', 'error'); return; }
    const techId = args[0];
    const approach = args[1] || 'tinkering';
    const result = this.game.technology.attemptDiscovery(player, techId, { tools: 1, materials: 1 }, approach);
    this.game.advanceTurns(480);
    if (result?.success) this.log(`Discovered ${techId}!`, 'success');
    else this.log(`Discovery failed: ${result?.reason || 'unknown'}`, 'error');
  }

  observePhenomenon(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: observe <phenomenon>', 'error'); this.log('  e.g. observe rain_pattern, soil_quality, plant_growth', 'info'); return; }
    const phenomenon = args.join('_');
    this.game.knowledge.observe(player, phenomenon, { location: player.position, weather: 'clear' });
    this.game.advanceTurns(30);
    this.log(`Observed "${phenomenon}" — recorded as evidence.`, 'success');
  }

  // ─── Culture / Language ────────────────────────────────────────────

  listLanguages() {
    const langs = this.game.language.languages;
    if (!langs || langs.size === 0) {
      this.log('No languages generated yet. Procedural pipeline will create them on world-gen.', 'system');
      return;
    }
    this.log('Known languages:', 'system');
    for (const [, lang] of langs) {
      this.log(`  ${lang.name} (${lang.grammar?.wordOrder || '?'}) — ${lang.vocabulary?.size || 0} words`, 'info');
    }
  }

  showCulture() {
    if (!this.game.culture) { this.log('No culture system.', 'error'); return; }
    const traditions = this.game.culture.traditions || new Map();
    if (traditions.size === 0) {
      this.log('Culture system active. Use "form-faction <name> religious" or play through a generation to see traditions emerge.', 'info');
      return;
    }
    this.log('Cultural traditions:', 'system');
    for (const [, t] of traditions) this.log(`  ${t.name}: ${t.description || ''}`, 'info');
  }

  // ─── Food / Cooking ────────────────────────────────────────────────

  listRecipes() {
    const recipes = this.game.foodSystem.recipes || {};
    const names = Object.keys(recipes);
    if (names.length === 0) { this.log('No recipes loaded.', 'error'); return; }
    this.log('Recipes you can cook:', 'system');
    for (const name of names.slice(0, 15)) {
      const recipe = recipes[name];
      const ingredients = (recipe.ingredients || []).map(i => i.item || i).join(', ');
      this.log(`  ${name} — needs: ${ingredients}`, 'info');
    }
    this.log('Use "cook <recipe>" to cook with your inventory items.', 'system');
  }

  cook(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: cook <recipe>', 'error'); return; }
    const recipeName = args.join(' ');
    const inventory = player.inventory.items || [];
    const result = this.game.foodSystem.cook(recipeName, inventory, player.skills?.knowledge?.agriculture || 0, ['fire']);
    this.game.advanceTurns(60);
    if (result?.success !== false) this.log(`Cooked ${recipeName}.`, 'success');
    else this.log(`Could not cook: ${result?.reason || 'unknown'}`, 'error');
  }

  // ─── Disease / Treatment ───────────────────────────────────────────

  exposeToDisease(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: infect <disease>', 'error'); return; }
    const disease = args[0];
    const result = this.game.pathogens.expose(player, disease, null, 'contact');
    if (result?.infected) this.log(`You contracted ${disease}!`, 'error');
    else if (result?.success === false) this.log(`Not infected: ${result.reason}`, 'info');
    else this.log(`Exposed to ${disease} (immunity check).`, 'system');
  }

  treatDisease(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const infections = this.game.pathogens.getActiveInfections(player.id);
    if (!infections || infections.length === 0) { this.log('You have no active infections.', 'info'); return; }
    const treatment = args.join(' ') || 'willow_bark';
    const result = this.game.treatment.administer(player, player, treatment, { herbs: 1 });
    this.game.advanceTurns(120);
    if (result?.success) this.log(`Treatment "${treatment}" applied.`, 'success');
    else this.log(`Treatment failed: ${result?.reason || 'unknown'}`, 'error');
  }

  // ─── Mega Battles ──────────────────────────────────────────────────

  declareBattle(args) {
    if (args.length < 2) { this.log('Usage: declare-battle <armyId> <enemyArmyId> [terrain]', 'error'); return; }
    const a1 = parseInt(args[0]); const a2 = parseInt(args[1]);
    const terrain = args[2] || 'plains';
    const result = this.game.warfare.engageBattle(a1, a2, terrain);
    this.game.advanceTurns(60);
    if (result.success) this.log(`⚔  Battle ${result.battle.id} begun on ${terrain}!`, 'combat');
    else this.log(`Could not engage: ${result.reason}`, 'error');
  }

  battleStatus(args) {
    const battles = this.game.warfare.getActiveBattles();
    const sieges = this.game.warfare.getActiveSieges();
    if (battles.length === 0 && sieges.length === 0) { this.log('No active battles or sieges.', 'info'); return; }
    for (const b of battles) {
      const a1 = this.game.warfare.getArmy(b.armies[0]);
      const a2 = this.game.warfare.getArmy(b.armies[1]);
      this.log(`⚔  Battle ${b.id} (${b.terrain}): A${a1.id} [${a1.soldiers.length}/${a1.casualties} cas, morale ${a1.morale.toFixed(2)}] vs A${a2.id} [${a2.soldiers.length}/${a2.casualties} cas, morale ${a2.morale.toFixed(2)}] — round ${b.rounds.length}`, 'combat');
    }
    for (const s of sieges) {
      const a = this.game.warfare.getArmy(s.attacker);
      const d = this.game.warfare.getArmy(s.defender);
      this.log(`🏰 Siege ${s.id}: attackers ${a.soldiers.length}, defenders ${d.soldiers.length}, supplies A:${Math.floor(s.attackerSupplies)} D:${Math.floor(s.defenderSupplies)}`, 'combat');
    }
  }

  battleRound(args) {
    const battles = this.game.warfare.getActiveBattles();
    if (battles.length === 0) { this.log('No active battles.', 'info'); return; }
    const battle = args[0] ? battles.find(b => b.id === parseInt(args[0])) : battles[0];
    if (!battle) { this.log('Battle not found.', 'error'); return; }
    const r = this.game.warfare.simulateBattleRound(battle.id);
    this.game.advanceTurns(60);
    if (r.success) {
      const a1 = this.game.warfare.getArmy(battle.armies[0]);
      const a2 = this.game.warfare.getArmy(battle.armies[1]);
      this.log(`Round ${r.round.round}: A${a1.id} casualties ${r.round.casualties[a1.id]}, A${a2.id} casualties ${r.round.casualties[a2.id]}. ${r.ongoing ? 'Battle continues.' : `Victor: A${this.game.warfare.getBattle(battle.id).victor}!`}`, 'combat');
    } else this.log(`Battle ended: ${r.reason}`, 'error');
  }

  marchArmy(args) {
    if (args.length < 3) { this.log('Usage: march <armyId> <x> <y>', 'error'); return; }
    const id = parseInt(args[0]); const x = parseInt(args[1]); const y = parseInt(args[2]);
    const result = this.game.warfare.march(id, { x, y }, 10);
    this.game.advanceTurns(60);
    if (result.success) this.log(`Army ${id} marched to (${x},${y}).`, 'success');
    else this.log(`March failed: ${result.reason}`, 'error');
  }

  retreatArmy(args) {
    if (args.length < 1) { this.log('Usage: retreat <armyId>', 'error'); return; }
    const id = parseInt(args[0]);
    const r = this.game.warfare.retreat(id);
    this.game.advanceTurns(60);
    this.log(`Army ${id} retreated — ${r.casualties} casualties, morale ${r.morale.toFixed(2)}.`, 'combat');
  }

  assaultSiege(args) {
    if (args.length < 1) { this.log('Usage: assault <siegeId>', 'error'); return; }
    const id = parseInt(args[0]);
    const r = this.game.warfare.assault(id);
    this.game.advanceTurns(120);
    if (r.success) this.log(`Assault on siege ${id}: ${r.assault.success ? 'SUCCESS' : 'FAILED'} — A casualties ${r.assault.attackerCasualties}, D casualties ${r.assault.defenderCasualties}.`, 'combat');
    else this.log(`Assault failed: ${r.reason}`, 'error');
  }

  // ─── Betrayal, Scheme, Coup, Spy ───────────────────────────────────

  betrayFaction(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: betray <factionId> [reason]', 'error'); return; }
    const fid = parseInt(args[0]);
    const reason = args.slice(1).join(' ') || 'personal';
    const factions = this.game.factions.getFactionsByMember(player.id);
    const ownFaction = factions.find(f => f.id === fid);
    if (!ownFaction) { this.log('You are not in that faction.', 'error'); return; }
    const stolenSecrets = ownFaction.resources ? [`resources_${ownFaction.resources}`] : [];
    const r = this.game.factions.betray(fid, player.id, reason, stolenSecrets);
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
    if (r.successionCrisis?.dissolved) this.log('The faction has dissolved.', 'combat');
  }

  runScheme(args) {
    if (args.length < 1) { this.log('Usage: scheme <targetFactionId> [type] [ownFactionId]', 'error'); this.log('  types: espionage, sabotage, propaganda, theft', 'info'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const target = parseInt(args[0]);
    const type = args[1] || 'espionage';
    const ownFaction = this.game.factions.getFactionsByMember(player.id)[0];
    const r = this.game.factions.scheme(player.id, ownFaction?.id ?? null, target, type);
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
  }

  runEspionage(args) {
    if (args.length < 1) { this.log('Usage: spy <governmentId> [operation]', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const gid = parseInt(args[0]);
    const op = args[1] || 'reconnaissance';
    const r = this.game.politics.conductEspionage(player, gid, op);
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
    if (r.secrets?.length) this.log(`  Secrets: ${r.secrets.join(', ')}`, 'system');
  }

  runCoup(args) {
    if (args.length < 1) { this.log('Usage: coup <governmentId> [justification]', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const gid = parseInt(args[0]);
    const justification = args.slice(1).join(' ') || 'overthrow tyranny';
    const conspirators = this.game.factions.getFactionsByMember(player.id)
      .flatMap(f => f.members.map(id => this.game.kernel.entities.get(id)))
      .filter(p => p && p !== player);
    const r = this.game.politics.attemptCoup(gid, player, conspirators.slice(0, 5), justification);
    this.game.advanceTurns(480);
    this.log(r.message, r.success ? 'combat' : 'error');
  }

  listIntrigues() {
    const betrayals = this.game.factions.getBetrayals();
    const schemes = this.game.factions.getSchemes();
    const coups = this.game.politics.getCoups();
    const espionage = this.game.politics.getEspionage();
    if (!betrayals.length && !schemes.length && !coups.length && !espionage.length) {
      this.log('No intrigues recorded yet.', 'info'); return;
    }
    for (const b of betrayals.slice(-5)) this.log(`🗡  Betrayal: ${b.person} betrayed faction ${b.faction} — "${b.reason}"`, 'combat');
    for (const s of schemes.slice(-5)) this.log(`🕵  Scheme: ${s.type} → ${s.target} (${s.success ? 'success' : 'failed'}${s.detected ? ', detected' : ''})`, 'combat');
    for (const c of coups.slice(-5)) this.log(`👑  Coup: faction ${c.government} — ${c.success ? 'succeeded' : 'failed'} (${c.justification})`, 'combat');
    for (const e of espionage.slice(-5)) this.log(`🔍  Spy: ${e.operation} → ${e.target} (${e.secrets.length} secrets${e.detected ? ', detected' : ''})`, 'combat');
  }

  // ─── Crime, Theft, Laws ────────────────────────────────────────────

  async stealItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) { this.log('Usage: steal <person> [itemIndex]', 'error'); return; }
    const targetName = args[0];
    const itemIndex = parseInt(args[1]) || 0;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 5);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(targetName.toLowerCase()) && p !== player);
    if (!target) { this.log(`No "${targetName}" nearby.`, 'error'); return; }
    const r = this.game.law.attemptTheft(player, target, itemIndex);
    this.game.advanceTurns(30);
    if (r.success) {
      this.log(r.message, 'success');
      this.log('  ⚠  A crime has been recorded in the law archives.', 'system');
    } else {
      this.log(r.message, 'error');
      this.log(`  A case has been opened: case ${r.crime?.case?.id}`, 'combat');
    }
  }

  accusePerson(args) {
    if (args.length < 2) { this.log('Usage: accuse <person> <crime>', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const targetName = args[0];
    const crime = args[1];
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 20);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(targetName.toLowerCase()) && p !== player);
    if (!target) { this.log(`No "${targetName}" nearby.`, 'error'); return; }
    const r = this.game.accuse(target, crime, ['witnessed']);
    this.game.advanceTurns(60);
    if (r.success) this.log(`Accusation filed: case ${r.case.id} against ${target.name} for ${crime}.`, 'combat');
    else this.log(`Accusation failed: ${r.reason}`, 'error');
  }

  listLaws() {
    const laws = this.game.law.getActiveLaws();
    if (laws.length === 0) {
      this.log('No laws enacted yet. Trigger an event with "enact-law <eventType>" to create one.', 'info');
      this.log('  event types: theft_wave, assault_wave, plague_outbreak, crop_failure, war, betrayal', 'system');
      return;
    }
    this.log(`Active laws (${laws.length}):`, 'system');
    for (const l of laws) this.log(`  ${l.id}. ${l.name} — ${l.description} [penalty: ${l.penalty.type}]`, 'info');
  }

  listCases(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const accused = this.game.law.getCasesByAccused(player.id);
    const accuser = this.game.law.getCasesByAccuser(player.id);
    if (accused.length === 0 && accuser.length === 0) { this.log('You have no legal cases.', 'info'); return; }
    for (const c of accused) this.log(`  Case ${c.id}: YOU accused of ${c.crimeType} (${c.status})`, 'error');
    for (const c of accuser) this.log(`  Case ${c.id}: you accused someone of ${c.crimeType} (${c.status})`, 'system');
  }

  enactDynamicLaw(args) {
    if (args.length === 0) { this.log('Usage: enact-law <eventType>', 'error'); return; }
    const player = this.game.getPlayer();
    const sid = player?.position?.settlementId;
    const r = this.game.triggerDynamicLaw(args[0], sid);
    if (r.success) this.log(`Law "${r.law.name}" enacted in response to ${args[0]}.`, 'success');
    else this.log(`Could not enact: ${r.reason}`, 'error');
  }

  // ─── Noble Titles / Class System ───────────────────────────────────

  showTitles() {
    const player = this.game.getPlayer();
    if (!player) return;
    const current = this.game.titles.getTitle(player);
    this.log(`Your title: ${current}`, 'system');
    this.log('Available ranks (in order):', 'info');
    for (const rank of this.game.titles.getTitleRanks()) {
      const elig = this.game.titles.checkEligibility(player, rank);
      const mark = current === rank ? '★' : (elig.eligible ? '○' : '·');
      const note = current === rank ? ' (current)' : (elig.eligible ? ' (eligible!)' : ` — ${elig.reason || ''}`);
      this.log(`  ${mark} ${rank}${note}`, 'info');
    }
  }

  claimTitle(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: claim-title <rank>', 'error'); return; }
    const rank = args[0];
    const elig = this.game.titles.checkEligibility(player, rank);
    if (!elig.eligible) { this.log(`Not eligible: ${elig.reason}`, 'error'); return; }
    const r = this.game.titles.grant(player, rank, null, 'Self-claimed by right of merit');
    this.game.advanceTurns(60);
    if (r.success) this.log(`✦ You are now ${rank} ${player.name}!`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
  }

  grantTitle(args) {
    if (args.length < 2) { this.log('Usage: grant-title <person> <rank>', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const myTitle = this.game.titles.getTitle(player);
    if (!['king', 'duke', 'count', 'baron'].includes(myTitle)) {
      this.log(`Only nobles (baron+) can grant titles. You are a ${myTitle}.`, 'error');
      return;
    }
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player);
    if (!target) { this.log(`No "${args[0]}" nearby.`, 'error'); return; }
    const r = this.game.titles.grant(target, args[1], player, `Granted by ${myTitle} ${player.name}`);
    this.game.advanceTurns(60);
    if (r.success) this.log(`Granted ${args[1]} to ${target.name}.`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
  }

  showHouse() {
    const player = this.game.getPlayer();
    if (!player) return;
    const house = this.game.titles.getHouseForPerson(player.id);
    if (!house) { this.log('You have no noble house.', 'info'); return; }
    this.log(`${house.name} — founded ${new Date(house.founded).toLocaleDateString()}`, 'system');
    this.log(`  Lord: ${this.game.kernel.entities.get(house.lord)?.name || '?'}`, 'info');
    this.log(`  Members: ${house.members.length}`, 'info');
    this.log(`  Treasury: ${house.treasury}`, 'info');
    this.log(`  Lands: ${house.lands.length}`, 'info');
  }

  raiseLevy(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const count = parseInt(args[0]) || 10;
    const r = this.game.titles.raiseLevy(player, count);
    this.log(r.message, r.success ? 'success' : 'error');
  }

  holdCourt() {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.titles.holdCourt(player);
    this.game.advanceTurns(240);
    if (r.success) {
      this.log(`Court held: tax rate ${(r.taxRate * 100).toFixed(0)}%, ${r.casesAssigned} cases assigned.`, 'success');
    } else this.log(`Failed: ${r.reason}`, 'error');
  }

  // ─── Magic ──────────────────────────────────────────────────────────

  listSpells() {
    const player = this.game.getPlayer();
    if (!player) return;
    const known = this.game.magic.getKnownSpells(player);
    this.log(`Known spells (${known.length}):`, 'system');
    for (const s of known) this.log(`  ${s}`, 'info');
    this.log('Use "learn <spell>" to study; "cast <spell>" to cast.', 'info');
  }

  learnSpell(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: learn <spell>', 'error'); return; }
    const r = this.game.magic.learnSpell(player, args[0], 8);
    this.game.advanceTurns(480);
    if (r.success) this.log(`Studied ${args[0]}.`, 'success');
    else this.log(`Cannot learn: ${r.reason}`, 'error');
  }

  castSpell(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: cast <spell> [target]', 'error'); return; }
    let target = player;
    if (args.length > 1) {
      const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
      target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[1].toLowerCase())) || player;
    }
    const r = this.game.magic.cast(player, args[0], target);
    this.game.advanceTurns(30);
    if (r.success) {
      this.log(`Cast ${args[0]}!${r.backlash ? ' (backlash!)' : ''}`, 'success');
      if (r.effect?.revelation) this.log(`  ${r.effect.revelation}`, 'system');
    } else this.log(`Cast failed: ${r.reason}`, 'error');
  }

  showMana() {
    const player = this.game.getPlayer();
    if (!player) return;
    const pool = this.game.magic.getPool(player);
    this.log(`Mana: ${Math.floor(pool.current)}/${pool.max} (regen ${pool.regen}/turn)`, 'system');
    const effects = this.game.magic.getActiveEffects().filter(e => e.caster === player.id || e.target === player.id);
    if (effects.length > 0) this.log(`Active effects: ${effects.length}`, 'info');
  }

  forgeArtifact(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: forge <name>', 'error'); return; }
    const a = this.game.magic.forgeArtifact(player, args.join(' '), { school: 'arcane' });
    this.game.advanceTurns(480);
    this.log(`Forged artifact "${a.name}" — charges: ${a.charges}.`, 'success');
  }

  // ─── Religion commands ──────────────────────────────────────────────

  pray(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const deityId = parseInt(args[0]) || 0;
    const intent = args[1] || 'private';
    const r = this.game.religion?.pray?.(player, deityId, intent);
    this.game.advanceTurns(15);
    if (r?.success) this.log(`Your prayer is offered.`, 'success');
    else this.log('You pause in silent contemplation.', 'info');
  }

  /**
   * T6-2: Convert the player to the active pantheon. Sets faith to 1.0,
   * religion to the local pantheon, and records the conversion in the
   * religion history. Grants passive morale boost at temples.
   */
  convertReligion() {
    const player = this.game.getPlayer();
    if (!player) return;
    const religion = this.game.religion;
    if (!religion?.pantheon) return this.log('No religion exists in this world.', 'error');
    const pantheonType = religion.pantheon.type || 'unknown';
    const deityName = religion.pantheon.deities?.[0]?.name || 'the gods';
    player.faith = 1.0;
    player.religion = pantheonType;
    player.religionDeity = deityName;
    if (!player._conversionHistory) player._conversionHistory = [];
    player._conversionHistory.push({
      religion: pantheonType,
      deity: deityName,
      turn: this.game.kernel.turn,
      worldTime: this.game.kernel.worldTime?.totalMinutes ?? 0
    });
    if (!religion.conversions) religion.conversions = [];
    religion.conversions.push({
      personId: player.id,
      name: player.name,
      religion: pantheonType,
      turn: this.game.kernel.turn
    });
    player.morale = Math.min(1, (player.morale || 0.5) + 0.1);
    this.game.advanceTurns(30);
    this.log(`You have converted to the ${pantheonType} faith (${deityName}). May it watch over you.`, 'success');
  }

  makeOffering(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: offering <food|drink|animal|wealth|incense>', 'error');
    const offeringType = args[0].toLowerCase();
    const itemMap = { food: 'food', drink: 'drink', wealth: 'coin', incense: 'herb', animal: 'meat', craft: 'tool' };
    const item = itemMap[offeringType] || offeringType;
    const r = this.game.religion?.makeOffering?.(player, 0, { type: offeringType, item });
    this.game.advanceTurns(10);
    if (r?.success) this.log(`Offering accepted.`, 'success');
    else this.log(`Cannot offer: ${r?.reason || 'unavailable'}`, 'error');
  }

  performRitual(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: ritual <type>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const participants = nearby.map(id => this.game.kernel.entities.get(id)).filter(p => p && p.alive && p !== player);
    const r = this.game.religion?.performRitual?.(player, args[0], participants);
    this.game.advanceTurns(60);
    if (r?.success) this.log(`Ritual performed with ${r.participants || 0} others.`, 'success');
    else this.log(`Ritual failed: ${r?.reason || 'unknown'}`, 'error');
  }

  showProphecy() {
    const prophecies = this.game.religion?.prophecies || [];
    if (prophecies.length === 0) return this.log('No recent prophecies.', 'info');
    this.log(`Prophecies (${prophecies.length}):`, 'system');
    for (const p of prophecies.slice(-5)) this.log(`  "${p.text}"`, 'info');
  }

  listTemples() {
    const temples = this.game.religion?.temples ? [...this.game.religion.temples.values()] : [];
    if (!temples.length) return this.log('No temples.', 'info');
    for (const t of temples) this.log(`  Temple #${t.id} at (${t.location?.x ?? '?'}, ${t.location?.y ?? '?'}) — clergy: ${t.clergy?.length || 0}`, 'info');
  }

  listClergy() {
    const clergy = this.game.religion?.clergy ? [...this.game.religion.clergy.values()] : [];
    if (!clergy.length) return this.log('No clergy.', 'info');
    for (const c of clergy) {
      const p = this.game.kernel.entities.get(c.personId);
      this.log(`  ${c.role}: ${p?.name || c.personId}`, 'info');
    }
  }

  ordainClergy(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: ordain <person> <role>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player);
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const role = args[1] || 'priest';
    const r = this.game.religion?.ordainClergy?.(target, role);
    if (r?.success) this.log(`Ordained ${target.name} as ${role}.`, 'success');
    else this.log(`Cannot ordain: ${r?.reason || 'unknown'}`, 'error');
  }

  blessFollower(args) {
    const player = this.game.getPlayer();
    if (!player || !player.clergy) return this.log('Only clergy can bless.', 'error');
    if (args.length === 0) return this.log('Usage: bless <person>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    target.morale = Math.min(1, (target.morale || 0.5) + 0.2);
    this.game.advanceTurns(30);
    this.log(`Blessed ${target.name}.`, 'success');
  }

  exorcise(args) {
    const player = this.game.getPlayer();
    if (!player || !player.clergy) return this.log('Only clergy can exorcise.', 'error');
    const infections = this.game.pathogens?.getActiveInfections?.(player.id) || [];
    this.game.advanceTurns(120);
    if (infections.length > 0) {
      this.log(`Rites performed — illness persists but morale restored.`, 'info');
    } else {
      this.log(`No affliction to exorcise.`, 'info');
    }
  }

  goPilgrimage(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: pilgrimage <settlement name>', 'error');
    const target = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase()));
    if (!target) return this.log(`No settlement "${args.join(' ')}".`, 'error');
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    player.position.x = target.x;
    player.position.y = target.y;
    this.game.advanceTurns(60);
    this.log(`Pilgrimage to ${target.name} complete.`, 'success');
  }

  sacrifice(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: sacrifice <animal|food|drink>', 'error');
    const inv = player.inventory?.items || [];
    const found = inv.find(i => i.type === args[0].toLowerCase() || i.subtype === args[0].toLowerCase());
    if (!found) return this.log(`You have no ${args[0]} to sacrifice.`, 'error');
    if (player.inventory.remove) player.inventory.remove(found.type, 1);
    this.game.advanceTurns(15);
    this.log(`Sacrificed ${found.type} on the altar.`, 'success');
  }

  // ─── Transportation commands ────────────────────────────────────────

  mountHorse(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: mount <vehicleId>', 'error');
    const id = parseInt(args[0]);
    const r = this.game.transportation?.mountVehicle?.(player, id);
    if (r?.success) this.log(`Mounted ${r.vehicle.name}.`, 'success');
    else this.log(`Cannot mount: ${r?.reason || 'unknown'}`, 'error');
  }

  dismount() {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.transportation?.dismount?.(player);
    if (r?.success) this.log('Dismounted.', 'success');
    else this.log(r?.reason || 'Not mounted.', 'error');
  }

  sailTo(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: sail <dx> <dy>', 'error');
    const r = this.game.transportation?.sail?.(player, parseInt(args[0]), parseInt(args[1]));
    if (r?.success) this.log(`Sailed ${r.distance.toFixed(1)} tiles (${r.ticks} ticks, condition: ${(r.condition*100).toFixed(0)}%).`, 'success');
    else this.log(`Cannot sail: ${r?.reason || 'unknown'}`, 'error');
  }

  driveCart(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: drive <dx> <dy>', 'error');
    const r = this.game.transportation?.drive?.(player, parseInt(args[0]), parseInt(args[1]));
    if (r?.success) this.log(`Drove ${r.distance.toFixed(1)} tiles (${r.ticks} ticks).`, 'success');
    else this.log(`Cannot drive: ${r?.reason || 'unknown'}`, 'error');
  }

  listVehicles() {
    const vehicles = this.game.transportation ? [...this.game.transportation.vehicles.values()] : [];
    if (!vehicles.length) return this.log('No vehicles in the world.', 'info');
    const byType = {};
    for (const v of vehicles) byType[v.type] = (byType[v.type] || 0) + 1;
    this.log(`Vehicles: ${vehicles.length} total.`, 'system');
    for (const [t, n] of Object.entries(byType)) this.log(`  ${t}: ${n}`, 'info');
    this.log('Use "mount <id>" to ride, "sail <dx> <dy>" to sail, "drive <dx> <dy>" to drive.', 'system');
  }

  listStables() {
    const player = this.game.getPlayer();
    if (!player) return;
    const sid = player.position?.settlementId ?? 0;
    const stable = this.game.transportation?.getStable?.(sid) || [];
    if (!stable.length) return this.log('No vehicles at this stable.', 'info');
    for (const v of stable) this.log(`  #${v.id} ${v.name} (${v.type}, condition ${(v.condition*100).toFixed(0)}%)`, 'info');
  }

  travelTo(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: travel <settlement name>', 'error');
    const target = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase()));
    if (!target) return this.log(`No settlement "${args.join(' ')}".`, 'error');
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const r = this.game.transportation?.travel?.(player, dx, dy);
    if (r?.success) {
      this.game.advanceTurns(r.ticks);
      this.log(`Traveled to ${target.name} (${r.distance.toFixed(1)} tiles, ${r.ticks} ticks).`, 'success');
    } else this.log(`Cannot travel: ${r?.reason || 'unknown'}`, 'error');
  }

  fastTravel(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: fast-travel <routeId>', 'error');
    const r = this.game.transportation?.fastTravel?.(player, args[0]);
    if (r?.success) this.log(`Fast-traveled via ${r.route.name}.`, 'success');
    else this.log(`Cannot fast-travel: ${r?.reason || 'unknown'}`, 'error');
  }

  cargoCmd(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const sub = args[0] || 'list';
    const traveler = this.game.transportation?.getTraveler?.(player.id);
    if (!traveler) {
      return this.log('Mount a vehicle first to manage cargo.', 'info');
    }
    const v = this.game.transportation.getVehicle(traveler.vehicle);
    if (!v) return this.log('No vehicle.', 'error');

    if (sub === 'list') {
      this.log(`Cargo on ${v.name} (${(v.cargoUsed || 0).toFixed(0)}/${v.cargoCapacity}):`, 'system');
      if (!v.cargo || v.cargo.length === 0) return this.log('  empty.', 'info');
      for (let i = 0; i < v.cargo.length; i++) {
        const c = v.cargo[i];
        this.log(`  [${i}] ${c.type} × ${c.quantity} (${c.weight.toFixed(0)} wt)`, 'info');
      }
      return;
    }
    if (sub === 'load') {
      const type = args[1] || 'goods';
      const weight = parseFloat(args[2]) || 1;
      const qty = parseInt(args[3]) || 1;
      const r = this.game.transportation.loadCargo(v.id, { type, weight }, qty);
      if (r?.success) this.log(`Loaded ${qty} ${type} onto ${v.name}.`, 'success');
      else this.log(`Cannot load: ${r?.reason || 'unknown'}`, 'error');
      return;
    }
    if (sub === 'unload') {
      const idx = parseInt(args[1]) || 0;
      const qty = parseInt(args[2]) || 1;
      const r = this.game.transportation.unloadCargo(v.id, idx, qty, player);
      if (r?.success) this.log(`Unloaded ${r.unloaded.quantity} ${r.unloaded.type}.`, 'success');
      else this.log(`Cannot unload: ${r?.reason || 'unknown'}`, 'error');
      return;
    }
    this.log('Usage: cargo <list|load <type> <weight> <qty>|unload <idx> <qty>>', 'error');
  }

  // ─── Governance commands ───────────────────────────────────────────

  holdElection(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: elect <governmentId>', 'error');
    const gid = parseInt(args[0]);
    const candidates = [];
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50);
    for (const id of nearby) {
      const p = this.game.kernel.entities.get(id);
      if (p && p.alive && p.age >= 25) candidates.push(p);
      if (candidates.length >= 5) break;
    }
    if (candidates.length === 0) return this.log('No eligible candidates.', 'error');
    const r = this.game.politics?.holdElection?.(gid, candidates);
    this.game.advanceTurns(60);
    if (r?.success) {
      const winner = this.game.kernel.entities.get(r.winner);
      this.log(`Election held — ${winner?.name || r.winner} is the new ruler.`, 'success');
    } else this.log(`Election failed: ${r?.reason}`, 'error');
  }

  coronate(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: coronate <governmentId> [monarch name]', 'error');
    const gid = parseInt(args[0]);
    let monarch = player;
    if (args[1]) {
      const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
      monarch = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[1].toLowerCase())) || player;
    }
    const r = this.game.politics?.coronate?.(gid, monarch, [], null);
    this.game.advanceTurns(120);
    if (r?.success) this.log(`👑 ${monarch.name || 'New ruler'} has been crowned.`, 'success');
    else this.log(`Coronation failed: ${r?.reason}`, 'error');
  }

  abdicateThrone() {
    const player = this.game.getPlayer();
    if (!player) return;
    const governments = [...this.game.politics.governments.values()].filter(g => g.ruler === player.id);
    if (governments.length === 0) return this.log('You rule no government.', 'error');
    const gov = governments[0];
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const heir = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.alive && p !== player && p.age >= 18);
    const r = this.game.politics.abdicate(gov.id, player, heir);
    this.game.advanceTurns(120);
    if (r?.heir) this.log(`Abdicated in favor of ${this.game.kernel.entities.get(r.heir)?.name || r.heir}.`, 'success');
    else if (r?.success) this.log('Abdicated — no heir, the realm falls to council.', 'system');
  }

  appointRegent(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: regent <person> [reason]', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const reason = args.slice(1).join(' ') || 'minority';
    const governments = [...this.game.politics.governments.values()].filter(g => g.ruler === player.id);
    if (governments.length === 0) return this.log('You rule no government.', 'error');
    const r = this.game.politics.appointRegent(governments[0].id, target, reason);
    this.game.advanceTurns(60);
    if (r?.success) this.log(`${target.name} is now regent (${reason}).`, 'success');
    else this.log(`Failed: ${r?.reason}`, 'error');
  }

  showDynasty() {
    const player = this.game.getPlayer();
    if (!player) return;
    const dynastyName = player.dynasty || (player.houseId ? `House #${player.houseId}` : null);
    if (!dynastyName) return this.log('You have no dynasty yet.', 'info');
    const d = this.game.politics?.getDynasty?.(dynastyName);
    if (!d) return this.log(`Dynasty "${dynastyName}" not recorded.`, 'info');
    this.log(`${d.name} — founded by #${d.founder}`, 'system');
    this.log(`Monarchs: ${d.monarchs.length}`, 'info');
    for (const m of d.monarchs.slice(-5)) {
      const p = this.game.kernel.entities.get(m.person);
      this.log(`  ${p?.name || m.person} (govt ${m.government})`, 'info');
    }
  }

  proposeLawCmd(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: propose-law <name>', 'error');
    const r = this.game.triggerDynamicLaw('plague_outbreak', player.position?.settlementId);
    this.game.advanceTurns(60);
    if (r?.success) this.log(`Law "${r.law.name}" proposed.`, 'success');
    else this.log(`Failed: ${r?.reason}`, 'error');
  }

  signTreaty(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: sign-treaty <govIdA> <govIdB>', 'error');
    const r = this.game.politics?.signTreaty?.(parseInt(args[0]), parseInt(args[1]), { nonAggression: true });
    this.game.advanceTurns(120);
    if (r?.success) this.log(`Treaty signed (${r.treaty.id}).`, 'success');
    else this.log(`Failed: ${r?.reason}`, 'error');
  }

  ratifyTreaty(args) {
    if (args.length < 1) return this.log('Usage: ratify <treatyId>', 'error');
    const id = args[0];
    const treaty = this.game.politics?.treaties?.get?.(id);
    if (!treaty) return this.log(`No treaty "${id}".`, 'error');
    treaty.active = true;
    treaty.ratified = this.game.kernel.turn;
    this.log('Treaty ratified.', 'success');
  }

  makeVassal(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: vassal <vassalGovId> <liegeGovId>', 'error');
    const r = this.game.politics?.makeVassal?.(parseInt(args[0]), parseInt(args[1]), { military: 100, tax: 0.1 });
    this.game.advanceTurns(60);
    if (r?.success) this.log('Vassalage established.', 'success');
    else this.log(`Failed: ${r?.reason}`, 'error');
  }

  holdCouncil(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: hold-council <governmentId> <proposal>', 'error');
    const gid = parseInt(args[0]);
    const proposal = args.slice(1).join(' ');
    const gov = this.game.politics.governments.get(gid);
    if (!gov) return this.log('Unknown government.', 'error');
    const voters = (gov.subjects || []).slice(0, 12).map(id => this.game.kernel.entities.get(id)).filter(Boolean);
    if (voters.length === 0) {
      // fall back to nearby nobles
      const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50);
      for (const id of nearby) {
        const p = this.game.kernel.entities.get(id);
        if (p && p.alive && p.age >= 18) voters.push(p);
        if (voters.length >= 8) break;
      }
    }
    const r = this.game.politics.holdCouncilSession(gid, proposal, voters);
    this.game.advanceTurns(120);
    if (r?.success !== undefined) this.log(`Council vote on "${proposal}": ${r.session.passed ? 'PASSED' : 'FAILED'} (for ${r.session.tally.for}, against ${r.session.tally.against}).`, r.session.passed ? 'success' : 'error');
    else this.log('Council session failed.', 'error');
  }

  quit() {
    this.log('Ending life...', 'system');
    this.rl.close();
  }

  // Utility methods
  log(message, type = 'info') {
    const prefix = {
      'info': '•',
      'action': '→',
      'success': '✓',
      'error': '✗',
      'combat': '⚔',
      'system': '⚙'
    }[type] || '•';
    
    const msg = `${prefix} ${message}`;
    this.messageLog.push(msg);
    
    if (this.messageLog.length > this.maxLogSize) {
      this.messageLog.shift();
    }
    
    if (!this.game.player) {
      console.log(msg);
    }
  }

  center(text) {
    const padding = Math.max(0, Math.floor((this.width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  pad(text, width) {
    if (text.length >= width) {
      return text.substring(0, width);
    }
    return text + ' '.repeat(width - text.length);
  }

  drawLine(char, left, right) {
    process.stdout.write(left + char.repeat(this.width - 2) + right + '\n');
  }

  drawText(text, align = 'left') {
    const content = text.substring(0, this.width - 4);
    let line = '║ ';
    
    if (align === 'center') {
      const padding = Math.floor((this.width - 4 - content.length) / 2);
      line += ' '.repeat(padding) + content + ' '.repeat(this.width - 4 - padding - content.length);
    } else {
      line += content + ' '.repeat(this.width - 4 - content.length);
    }
    
    line += ' ║\n';
    process.stdout.write(line);
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Interactive selection menu
  showSelectionMenu(items, title, formatter = (item) => item.toString()) {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];
    
    this.clearScreen();
    console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║  ${title.padEnd(77)}║`);
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
    
    items.forEach((item, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${formatter(item)}`);
    });
    
    console.log('\n  0. Cancel\n');
    
    return new Promise((resolve) => {
      this.rl.question('Select number: ', (answer) => {
        const choice = parseInt(answer);
        
        if (isNaN(choice) || choice < 0 || choice > items.length) {
          this.log('Invalid selection.', 'error');
          resolve(null);
        } else if (choice === 0) {
          this.log('Cancelled.', 'system');
          resolve(null);
        } else {
          resolve(items[choice - 1]);
        }
        
        if (this.game.player) {
          this.showGameScreen();
        }
        this.rl.prompt();
      });
    });
  }
}