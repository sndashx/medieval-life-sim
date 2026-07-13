import blessed from 'blessed';
import contrib from 'blessed-contrib';
import fs from 'fs';
import path from 'path';
import { Combat } from '../systems/Combat.js';

export class RoguelikeUI {
  constructor(game) {
    this.game = game;
    this.groundItems = new Map();
    this.messageHistory = [];
    this.maxMessages = 1000;
    this.viewMode = 'normal';
    this.selectedPanel = 'location';
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Medieval Life Simulation - Roguelike Edition',
      fullUnicode: true,
      dockBorders: true,
      cursor: {
        artificial: true,
        shape: 'block',
        blink: true,
        color: 'white'
      }
    });
    
    this.setupUI();
    this.setupKeybindings();

    if (typeof this.game.registerUIListener === 'function') {
      this._unregisterUI = this.game.registerUIListener((msg, type) => this.log(msg, type || 'system'));
    }
  }

  setupUI() {
    this.grid = new contrib.grid({
      rows: 24,
      cols: 24,
      screen: this.screen
    });
    
    this.titleBar = this.grid.set(0, 0, 1, 24, blessed.box, {
      content: '',
      tags: true,
      style: { fg: 'white', bg: 'blue', bold: true }
    });
    
    this.mapBox = this.grid.set(1, 0, 10, 12, blessed.box, {
      label: ' 🗺️  World Map [M] ',
      tags: true,
      border: { type: 'line', fg: 'cyan' },
      style: { fg: 'white', border: { fg: 'cyan' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      scrollbar: { ch: '█', style: { fg: 'cyan' } }
    });
    
    this.locationBox = this.grid.set(1, 12, 10, 12, blessed.box, {
      label: ' 📍 Location Details [L] ',
      tags: true,
      border: { type: 'line', fg: 'green' },
      style: { fg: 'white', border: { fg: 'green' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      scrollbar: { ch: '█', style: { fg: 'green' } }
    });
    
    this.characterBox = this.grid.set(11, 0, 6, 8, blessed.box, {
      label: ' 👤 Character [C] ',
      tags: true,
      border: { type: 'line', fg: 'yellow' },
      style: { fg: 'white', border: { fg: 'yellow' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });
    
    this.physiologyBox = this.grid.set(11, 8, 6, 8, blessed.box, {
      label: ' 💚 Physiology [P] ',
      tags: true,
      border: { type: 'line', fg: 'green' },
      style: { fg: 'white', border: { fg: 'green' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });
    
    this.skillsBox = this.grid.set(11, 16, 6, 8, blessed.box, {
      label: ' 📚 Skills & Knowledge [K] ',
      tags: true,
      border: { type: 'line', fg: 'magenta' },
      style: { fg: 'white', border: { fg: 'magenta' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });
    
    this.inventoryBox = this.grid.set(17, 0, 5, 12, blessed.box, {
      label: ' 🎒 Inventory [I] ',
      tags: true,
      border: { type: 'line', fg: 'cyan' },
      style: { fg: 'white', border: { fg: 'cyan' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      scrollbar: { ch: '█', style: { fg: 'cyan' } }
    });
    
    this.equipmentBox = this.grid.set(17, 12, 5, 12, blessed.box, {
      label: ' ⚔️  Equipment & Combat [E] ',
      tags: true,
      border: { type: 'line', fg: 'red' },
      style: { fg: 'white', border: { fg: 'red' } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true
    });
    
    this.messageLog = this.grid.set(22, 0, 1, 24, blessed.log, {
      label: ' 📜 Messages [Tab: cycle filters] ',
      tags: true,
      border: { type: 'line', fg: 'yellow' },
      style: { fg: 'white', border: { fg: 'yellow' } },
      scrollable: true,
      scrollbar: { ch: '█', style: { fg: 'yellow' } }
    });
    
    this.commandInput = this.grid.set(23, 0, 1, 24, blessed.textbox, {
      label: ' 💬 Command [?: help] ',
      border: { type: 'line', fg: 'white' },
      style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
      inputOnFocus: true
    });
    
    this.commandInput.focus();
    this.screen.render();
  }

  setupKeybindings() {
    this.screen.key(['escape', 'C-c'], () => process.exit(0));
    this.screen.key([':', 'enter'], () => this.commandInput.focus());
    this.screen.key(['tab'], () => this.cyclePanels());
    this.screen.key(['m'], () => { this.mapBox.focus(); this.selectedPanel = 'map'; this.screen.render(); });
    this.screen.key(['l'], () => { this.locationBox.focus(); this.selectedPanel = 'location'; this.screen.render(); });
    this.screen.key(['c'], () => { this.characterBox.focus(); this.selectedPanel = 'character'; this.screen.render(); });
    this.screen.key(['i'], () => { this.inventoryBox.focus(); this.selectedPanel = 'inventory'; this.screen.render(); });
    this.screen.key(['k'], () => { this.skillsBox.focus(); this.selectedPanel = 'skills'; this.screen.render(); });
    this.screen.key(['p'], () => { this.physiologyBox.focus(); this.selectedPanel = 'physiology'; this.screen.render(); });
    this.screen.key(['e'], () => { this.equipmentBox.focus(); this.selectedPanel = 'equipment'; this.screen.render(); });
    this.screen.key(['?'], () => this.showHelp());
    
    this.commandInput.on('submit', (value) => {
      if (value) {
        this.handleCommand(value);
        this.commandInput.clearValue();
      }
      this.commandInput.focus();
      this.screen.render();
    });
    
    this.screen.key(['up', 'k'], () => {
      const focused = this.screen.focused;
      if (focused && focused.scroll) { focused.scroll(-1); this.screen.render(); }
    });
    
    this.screen.key(['down', 'j'], () => {
      const focused = this.screen.focused;
      if (focused && focused.scroll) { focused.scroll(1); this.screen.render(); }
    });
    
    this.screen.key(['pageup'], () => {
      const focused = this.screen.focused;
      if (focused && focused.scroll) { focused.scroll(-10); this.screen.render(); }
    });
    
    this.screen.key(['pagedown'], () => {
      const focused = this.screen.focused;
      if (focused && focused.scroll) { focused.scroll(10); this.screen.render(); }
    });
  }

  cyclePanels() {
    const panels = ['map', 'location', 'character', 'physiology', 'skills', 'inventory', 'equipment'];
    const currentIndex = panels.indexOf(this.selectedPanel);
    const nextIndex = (currentIndex + 1) % panels.length;
    this.selectedPanel = panels[nextIndex];
    
    const panelMap = {
      'map': this.mapBox, 'location': this.locationBox, 'character': this.characterBox,
      'physiology': this.physiologyBox, 'skills': this.skillsBox,
      'inventory': this.inventoryBox, 'equipment': this.equipmentBox
    };
    
    panelMap[this.selectedPanel].focus();
    this.screen.render();
  }

  start() {
    this.showWelcome();
    this.commandInput.focus();
    this.screen.render();
  }

  showWelcome() {
    const welcome = `
{center}{bold}{cyan-fg}╔═══════════════════════════════════════════════════════════════╗{/cyan-fg}{/bold}{/center}
{center}{bold}{white-fg}║          MEDIEVAL LIFE SIMULATION - ROGUELIKE EDITION         ║{/white-fg}{/bold}{/center}
{center}{bold}{cyan-fg}╚═══════════════════════════════════════════════════════════════╝{/cyan-fg}{/bold}{/center}

{bold}QUICK START:{/bold}  {green-fg}start{/green-fg} | {green-fg}?{/green-fg} help | {green-fg}quit{/green-fg}

{bold}NAVIGATION:{/bold}  {cyan-fg}Tab{/cyan-fg} cycle | {cyan-fg}M/L/C/I/K/P/E{/cyan-fg} panels | {cyan-fg}↑/↓ j/k{/cyan-fg} scroll

{center}Type {green-fg}start{/green-fg} to begin your medieval life...{/center}
`;
    
    this.locationBox.setContent(welcome);
    this.log('Welcome to Medieval Life Simulation - Roguelike Edition!', 'system');
    this.screen.render();
  }

  updateDisplay() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.updateTitleBar();
    this.updateMap();
    this.updateLocation();
    this.updateCharacter();
    this.updatePhysiology();
    this.updateSkills();
    this.updateInventory();
    this.updateEquipment();
    
    this.screen.render();
  }

  updateTitleBar() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const worldInfo = this.game.getWorldInfo();
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    
    const healthColor = health.overall > 0.7 ? 'green' : health.overall > 0.4 ? 'yellow' : 'red';
    const title = `  {bold}${player.name}{/bold} | Age {yellow-fg}${Math.floor(player.age)}{/yellow-fg} | HP {${healthColor}-fg}${Math.floor(health.overall * 100)}%{/${healthColor}-fg} | {magenta-fg}${worldInfo.season}{/magenta-fg} {blue-fg}${worldInfo.timeOfDay}{/blue-fg} | Turn {white-fg}${this.game.kernel.turn}{/white-fg}  `;
    
    this.titleBar.setContent(title);
  }

  updateMap() {
    const player = this.game.getPlayer();
    if (!player) return;

    const viewRadius = 15;
    const centerX = player.position.x;
    const centerY = player.position.y;

    // Build a quick lookup of settlements visible in the viewport
    const settlementSet = new Set();
    const settlements = this.game.world?.settlements || [];
    for (const s of settlements) {
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) {
        if (Math.abs(s.x - centerX) <= viewRadius && Math.abs(s.y - centerY) <= viewRadius) {
          settlementSet.add(`${s.x},${s.y}`);
        }
      }
    }

    let mapContent = '{center}{bold}ASCII World Map{/bold}{/center}\n\n';

    for (let y = centerY - viewRadius; y <= centerY + viewRadius; y++) {
      let line = '';
      for (let x = centerX - viewRadius; x <= centerX + viewRadius; x++) {
        if (x === centerX && y === centerY) {
          line += '{inverse}{white-fg}@{/white-fg}{/inverse}';
        } else if (settlementSet.has(`${x},${y}`)) {
          line += '{cyan-fg}#{/cyan-fg}';
        } else {
          const tile = this.game.world.getTile(x, y);
          line += tile ? this.getTileChar(tile) : ' ';
        }
      }
      mapContent += line + '\n';
    }

    mapContent += '\n{bold}Legend:{/bold} {green-fg}T{/green-fg} Forest {yellow-fg}"{/yellow-fg} Grass {blue-fg}~{/blue-fg} Water {gray-fg}^{/gray-fg} Mountain {cyan-fg}#{/cyan-fg} Settlement {white-fg}@{/white-fg} You\n';

    this.mapBox.setContent(mapContent);
  }

  getTileChar(tile) {
    if (tile.settlement) return '{cyan-fg}#{/cyan-fg}';
    if (tile.resources && tile.resources.length > 0) return '{brown-fg}•{/brown-fg}';
    if (tile.terrain.elevation > 150) return '{gray-fg}^{/gray-fg}';
    if (tile.terrain.elevation < 20) return '{blue-fg}~{/blue-fg}';
    if (tile.biome.type === 'forest') return '{green-fg}T{/green-fg}';
    if (tile.biome.type === 'grassland') return '{yellow-fg}"{/yellow-fg}';
    return '{gray-fg}.{/gray-fg}';
  }

  updateLocation() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    let content = '{center}{bold}{green-fg}═══ LOCATION ═══{/green-fg}{/bold}{/center}\n\n';
    
    content += `{bold}Coords:{/bold} ({cyan-fg}${player.position.x}{/cyan-fg}, {cyan-fg}${player.position.y}{/cyan-fg})\n`;
    content += `{bold}Biome:{/bold} ${this.capitalize(tile.biome.type)}\n`;
    content += `{bold}Elevation:{/bold} ${Math.floor(tile.terrain.elevation)}m\n`;
    content += `{bold}Temp:{/bold} ${Math.floor(tile.climate.temperature)}°C\n\n`;
    
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length > 0) {
      content += `{bold}{yellow-fg}Items:{/yellow-fg}{/bold}\n`;
      for (const item of groundItems.slice(0, 8)) {
        content += `  • ${item.type}\n`;
      }
    }
    
    this.locationBox.setContent(content);
  }

  updateCharacter() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const status = player.getStatus();
    let content = '{center}{bold}{yellow-fg}═══ CHARACTER ═══{/yellow-fg}{/bold}{/center}\n\n';
    
    content += `{bold}Name:{/bold} {cyan-fg}${status.name}{/cyan-fg}\n`;
    content += `{bold}Age:{/bold} ${status.age}\n`;
    content += `{bold}Sex:{/bold} ${this.capitalize(status.sex)}\n`;
    content += `{bold}Job:{/bold} {yellow-fg}${this.capitalize(status.occupation)}{/yellow-fg}\n`;
    
    this.characterBox.setContent(content);
  }

  updatePhysiology() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const health = player.physiology.getHealthStatus();
    const status = player.getStatus();
    
    let content = '{center}{bold}{green-fg}═══ PHYSIOLOGY ═══{/green-fg}{/bold}{/center}\n\n';
    
    const healthColor = health.overall > 0.7 ? 'green' : health.overall > 0.4 ? 'yellow' : 'red';
    content += `{bold}Health:{/bold} {${healthColor}-fg}${this.getBar(health.overall, 15)} ${Math.floor(health.overall * 100)}%{/${healthColor}-fg}\n`;
    
    const hungerColor = status.needs.hunger < 0.4 ? 'green' : status.needs.hunger < 0.7 ? 'yellow' : 'red';
    content += `{bold}Hunger:{/bold} {${hungerColor}-fg}${this.getBar(1 - status.needs.hunger, 15)}{/${hungerColor}-fg}\n`;
    
    const thirstColor = status.needs.thirst < 0.4 ? 'green' : status.needs.thirst < 0.7 ? 'yellow' : 'red';
    content += `{bold}Thirst:{/bold} {${thirstColor}-fg}${this.getBar(1 - status.needs.thirst, 15)}{/${thirstColor}-fg}\n`;
    
    this.physiologyBox.setContent(content);
  }

  updateSkills() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    let content = '{center}{bold}{magenta-fg}═══ SKILLS ═══{/magenta-fg}{/bold}{/center}\n\n';
    
    if (player.skills && player.skills.physical) {
      for (const [skill, value] of Object.entries(player.skills.physical).slice(0, 5)) {
        const color = value > 0.7 ? 'green' : value > 0.4 ? 'yellow' : 'red';
        content += `{bold}${this.capitalize(skill)}:{/bold} {${color}-fg}${this.getBar(value, 10)}{/${color}-fg}\n`;
      }
    }
    
    this.skillsBox.setContent(content);
  }

  updateInventory() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const weight = player.inventory.getWeight();
    const capacity = player.inventory.capacity;
    
    let content = '{center}{bold}{cyan-fg}═══ INVENTORY ═══{/cyan-fg}{/bold}{/center}\n\n';
    content += `{bold}Weight:{/bold} ${weight.toFixed(1)}/${capacity}kg\n\n`;
    
    if (player.inventory.items.length === 0) {
      content += '{gray-fg}(Empty){/gray-fg}\n';
    } else {
      for (const item of player.inventory.items.slice(0, 10)) {
        content += `  • ${item.type}\n`;
      }
    }
    
    this.inventoryBox.setContent(content);
  }

  updateEquipment() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    let content = '{center}{bold}{red-fg}═══ EQUIPMENT ═══{/red-fg}{/bold}{/center}\n\n';
    content += '{gray-fg}(Equipment system){/gray-fg}\n';
    
    this.equipmentBox.setContent(content);
  }

  getBar(value, length) {
    const filled = Math.floor(value * length);
    const empty = length - filled;
    return '[' + '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty)) + ']';
  }

  log(message, type = 'info') {
    const colors = { 'info': 'white', 'action': 'cyan', 'success': 'green', 'error': 'red', 'combat': 'magenta', 'system': 'yellow' };
    const icons = { 'info': '•', 'action': '→', 'success': '✓', 'error': '✗', 'combat': '⚔', 'system': '⚙' };
    
    const color = colors[type] || 'white';
    const icon = icons[type] || '•';
    const turn = this.game.kernel?.turn ?? 0;
    const timestamp = `[T${turn}]`;

    this.messageLog.log(`{gray-fg}${timestamp}{/gray-fg} {${color}-fg}${icon} ${message}{/${color}-fg}`);
    this.messageHistory.push({ text: message, type, turn });
    
    if (this.messageHistory.length > this.maxMessages) this.messageHistory.shift();
  }

  async handleCommand(input) {
    if (!input) return;
    
    const [command, ...args] = input.toLowerCase().split(' ');
    
    const commands = {
      'help': () => this.showHelp(), '?': () => this.showHelp(),
      'start': () => this.startNewLife(),
      'look': () => this.look(), 'l': () => this.look(),
      'move': () => this.move(args), 'm': () => this.move(args),
      'take': () => this.take(args),
      'drop': () => this.drop(args),
      'eat': () => this.eat(args), 'e': () => this.eat(args),
      'sleep': () => this.sleep(), 's': () => this.sleep(),
      'work': () => this.work(), 'w': () => this.work(),
      'quit': () => process.exit(0), 'exit': () => process.exit(0),
      'continue': () => this.continueAsHeir(args),
      'heirs': () => this.listHeirs(),
      'save': () => this.save(),
      'load': () => this.load(),
      'propose': () => this.propose(args),
      'family': () => this.showFamily(),
      'shop': () => this.listShops(),
      'craft': () => this.craft(args),
      'attack': () => this.attack(args),
      'drink': () => this.drink(),
      'browse': () => this.browseShop(args),
      'buy': () => this.buyItem(args),
      'sell': () => this.sellItem(args),
      'haggle': () => this.haggleItem(args),
      'repay': () => this.repayLoan(args),
      'loans': () => this.listLoans(),
      'borrow': () => this.borrowMoney(args),
      'dev': () => this.toggleDevMode(),
      'adopt': () => this.adoptChild(args),
      'gather': () => this.gatherResource(args),
      'hunt': () => this.huntAnimal(args),
      'harvest': () => this.harvestFlora(args),
      'plant': () => this.plantCrop(args),
      'gossip': () => this.gossip(args),
      'orphans': () => this.listOrphans(),
      'faction': () => this.listFactions(),
      'form-faction': () => this.formFaction(args),
      'warfare': () => this.warfareStatus(),
      'claim-land': () => this.claimLand(args),
      'buy-land': () => this.buyLand(args),
      'land': () => this.showLand(args),
      'muster': () => this.musterArmy(args),
      'barter': () => this.barter(args),
      'study': () => this.study(args),
      'apprentice': () => this.startApprenticeship(args),
      'discover': () => this.attemptDiscovery(args),
      'observe': () => this.observePhenomenon(args),
      'recipes': () => this.listRecipes(),
      'cook': () => this.cook(args),
      'cure': () => this.treatDisease(args),
      'declare-battle': () => this.declareBattle(args),
      'battle': () => this.battleStatus(),
      'battle-round': () => this.battleRound(args),
      'march': () => this.marchArmy(args),
      'retreat': () => this.retreatArmy(args),
      'assault': () => this.assaultSiege(args),
      'siege': () => this.startSiege(args),
      'betray': () => this.betrayFaction(args),
      'scheme': () => this.runScheme(args),
      'spy': () => this.runEspionage(args),
      'coup': () => this.runCoup(args),
      'intrigues': () => this.listIntrigues(),
      'steal': () => this.stealItem(args),
      'accuse': () => this.accusePerson(args),
      'laws': () => this.listLaws(),
      'cases': () => this.listCases(),
      'enact-law': () => this.enactDynamicLaw(args),
      'titles': () => this.showTitles(),
      'prayer': () => this.pray(args),
      'offering': () => this.makeOffering(args),
      'ritual': () => this.performRitual(args),
      'prophecy': () => this.showProphecy(),
      'temples': () => this.listTemples(),
      'clergy': () => this.listClergy(),
      'ordain': () => this.ordainClergy(args),
      'bless': () => this.blessFollower(args),
      'exorcise': () => this.exorcise(args),
      'pilgrimage': () => this.goPilgrimage(args),
      'sacrifice': () => this.sacrifice(args),
      'mount': () => this.mountHorse(args),
      'dismount': () => this.dismount(),
      'sail': () => this.sailTo(args),
      'drive': () => this.driveCart(args),
      'vehicles': () => this.listVehicles(),
      'stables': () => this.listStables(),
      'travel': () => this.travelTo(args),
      'fast-travel': () => this.fastTravel(args),
      'elect': () => this.holdElection(args),
      'coronate': () => this.coronate(args),
      'abdicate': () => this.abdicateThrone(),
      'regent': () => this.appointRegent(args),
      'dynasty': () => this.showDynasty(),
      'propose-law': () => this.proposeLawCmd(args),
      'sign-treaty': () => this.signTreaty(args),
      'ratify': () => this.ratifyTreaty(args),
      'vassal': () => this.makeVassal(args),
      'hold-council': () => this.holdCouncil(args),
      'claim-title': () => this.claimTitle(args),
      'house': () => this.showHouse(),
      'levy': () => this.raiseLevy(args),
      'court': () => this.holdCourt(),
      'spells': () => this.listSpells(),
      'learn': () => this.learnSpellCmd(args),
      'cast': () => this.castSpellCmd(args),
      'mana': () => this.showMana()
    };
    
    if (commands[command]) {
      try {
        await commands[command]();
      } catch (error) {
        this.log(`Error: ${error.message}`, 'error');
      }
    } else {
      this.log(`Unknown command: ${command}`, 'error');
    }
    
    this.screen.render();
  }

  showHelp() {
    const help = `
{center}{bold}{cyan-fg}COMMAND REFERENCE{/cyan-fg}{/bold}{/center}

{bold}Character:{/bold} start, status, inventory (i), continue, heirs, family, relations, dev
{bold}Actions:{/bold} look (l), move (m), take, drop, eat (e), drink, sleep (s), work (w), wait, gather, harvest, hunt, forage
{bold}Crafting/Knowledge:{/bold} craft, recipes, cook, study, apprentice, discover, observe, cure, infect
{bold}Social:{/bold} talk/chat, propose, marry, divorce, adopt, orphans, barter, faction(s), form-faction, join-faction, leave-faction, alliance, guild
{bold}War:{/bold} declare-war, warfare, muster, siege, declare-battle, battle, battle-round, march, retreat, assault
{bold}Politics:{/bold} betray, scheme, spy, coup, intrigues, steal, accuse, laws, cases, enact-law
{bold}Land:{/bold} claim-land, buy-land, sell-land, annex-land, land
{bold}Titles:{/bold} titles, claim-title, grant-title, house, levy, court
{bold}Religion:{/bold} prayer, offering, ritual, prophecy, temples, clergy, ordain, bless, exorcise, pilgrimage, sacrifice
{bold}Transport:{/bold} mount, dismount, sail, drive, vehicles, stables, travel, fast-travel
{bold}Governance:{/bold} elect, coronate, abdicate, regent, dynasty, propose-law, sign-treaty, ratify, vassal, hold-council
{bold}Trade:{/bold} shop, browse, buy, sell, haggle, loan
{bold}Magic:{/bold} spells, learn, cast, mana
{bold}System:{/bold} save, load, clear, refresh, help (?), quit
`;
    this.locationBox.setContent(help);
    this.log('Help displayed', 'system');
  }

  startNewLife() {
    if (this.game.player) {
      this.log('You already have an active life.', 'error');
      return;
    }
    
    const name = 'Adventurer';
    if (!this.game.kernel) throw new Error('kernel required');
    const sex = this.game.kernel.random() > 0.5 ? 'male' : 'female';
    
    const result = this.game.createPlayer(name, sex);
    if (result.success) {
      this.log(`You are born as ${name}.`, 'success');
      this.updateDisplay();
    } else {
      this.log(`Failed: ${result.error}`, 'error');
    }
  }

  look() {
    const player = this.game.getPlayer();
    if (!player) {
      this.log('No active character.', 'error');
      return;
    }
    
    this.updateDisplay();
    this.log('You look around.', 'action');
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
      this.log('Invalid direction.', 'error');
      return;
    }
    
    player.position.x += directions[dir].x;
    player.position.y += directions[dir].y;
    
    this.game.kernel.entityIndex.update(player);
    this.game.advanceTurns(1);
    
    this.log(`You move ${dir}.`, 'action');
    this.updateDisplay();
  }

  take(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) return this.log('Usage: take <item>', 'error');
    const locKey = `${player.position.x},${player.position.y}`;
    const items = this.groundItems.get(locKey) || [];
    if (!items.length) return this.log('Nothing here.', 'error');
    const found = items.find(i => i.type.toLowerCase().includes(args[0].toLowerCase()) || (i.subtype && i.subtype.toLowerCase().includes(args[0].toLowerCase())));
    if (!found) return this.log(`No "${args[0]}" here.`, 'error');
    if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
    if (player.inventory.getWeight && player.inventory.getWeight() + (found.mass || 0) > (player.inventory.capacity || 50)) {
      return this.log('Too heavy.', 'error');
    }
    const result = player.inventory.add(found);
    if (result && result.success === false) return this.log(`Too heavy: ${result.reason}`, 'error');
    const remaining = items.filter(i => i !== found);
    if (remaining.length) this.groundItems.set(locKey, remaining);
    else this.groundItems.delete(locKey);
    this.game.advanceTurns(1);
    this.log(`Picked up ${found.type}.`, 'success');
  }

  drop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) return this.log('Usage: drop <item>', 'error');
    if (!player.inventory?.items?.length) return this.log('Inventory empty.', 'error');
    const item = player.inventory.items.find(i =>
      i.type.toLowerCase().includes(args[0].toLowerCase()) ||
      (i.subtype && i.subtype.toLowerCase().includes(args[0].toLowerCase()))
    );
    if (!item) return this.log(`You don't have "${args[0]}".`, 'error');
    const removed = player.inventory.remove(item.type, 1);
    if (!removed) return this.log(`Could not drop ${item.type}.`, 'error');
    const locKey = `${player.position.x},${player.position.y}`;
    const items = this.groundItems.get(locKey) || [];
    items.push(item);
    this.groundItems.set(locKey, items);
    this.game.advanceTurns(1);
    this.log(`Dropped ${item.type}.`, 'action');
  }

  eat(args) {
    const player = this.game.getPlayer();
    if (!player) return;

    const inv = player.inventory?.items || [];
    const query = (args.join(' ') || 'food').toLowerCase();
    const food = inv.find(i =>
      i.type?.toLowerCase() === query ||
      i.subtype?.toLowerCase() === query ||
      i.type?.toLowerCase().includes(query) ||
      (query === 'food' && (i.type === 'food' || i.subtype === 'food'))
    );
    if (!food) return this.log(`You don't have any ${query} to eat.`, 'error');

    if (typeof player.physiology?.consume === 'function') player.physiology.consume(food);
    player.inventory.remove(food.type, 1);
    player.needs.satisfy('hunger', 0.5);
    this.game.advanceTurns(1);
    this.log(`You eat the ${food.type}.`, 'action');
    this.updateDisplay();
  }

  sleep() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.log('You sleep...', 'action');
    this.game.advanceTurns(8);
    player.needs.satisfy('sleep', 1.0);
    this.log('You wake up refreshed.', 'success');
    this.updateDisplay();
  }

  work() {
    const player = this.game.getPlayer();
    if (!player) return;

    this.log(`You work as a ${player.occupation}...`, 'action');
    this.game.advanceTurns(8);

    const household = this.game.kernel.entities.get(player.household);
    const health = player.physiology?.getHealthStatus?.() || { strength: 0.5 };
    const skillVal = player.skills?.knowledge?.agriculture
      ?? player.skills?.physical?.hunting?.level
      ?? player.skills?.crafting?.woodwork
      ?? 0.3;
    const productivity = skillVal * (health.strength || 0.5);
    if (household) {
      const addWealth = typeof household.addWealth === 'function' ? household.addWealth : (n) => { household.wealth = (household.wealth || 0) + n; };
      addWealth.call(household, productivity * 10);
      household.food = (household.food || 0) + productivity * 5;
      this.log(`Earned ${(productivity * 10).toFixed(0)} wealth, ${(productivity * 5).toFixed(0)} food.`, 'success');
    } else {
      this.log('No household to deposit earnings.', 'info');
    }
    this.updateDisplay();
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getBiomeDescription(biome) { return 'A natural environment'; }

  save() {
    try {
      const saveData = this.game.save();
      const saveDir = path.join(process.cwd(), 'saves');
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `save_${this.game.player?.name || 'unknown'}_${ts}.json`;
      fs.writeFileSync(path.join(saveDir, filename), JSON.stringify(saveData, null, 2));
      this.log(`Game saved to: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save: ${error.message}`, 'error');
    }
  }

  load() {
    try {
      const saveDir = path.join(process.cwd(), 'saves');
      if (!fs.existsSync(saveDir)) { this.log('No saves directory found.', 'error'); return; }
      const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) { this.log('No save files found.', 'error'); return; }
      const latest = files.sort().reverse()[0];
      const data = JSON.parse(fs.readFileSync(path.join(saveDir, latest), 'utf8'));
      const result = this.game.load(data);
      if (result.success) {
        this.log(`Loaded: ${latest}`, 'success');
        this.updateDisplay();
      } else {
        this.log(`Load failed: ${result.error || 'unknown error'}`, 'error');
      }
    } catch (error) {
      this.log(`Failed to load: ${error.message}`, 'error');
    }
  }

  continueAsHeir(args) {
    const player = this.game.getPlayer();
    if (player && player.alive) { this.log('Your character is still alive.', 'error'); return; }
    const idx = parseInt(args[0]) || 0;
    const result = this.game.continueAsHeir(idx);
    if (result.success) {
      this.log(`You are now ${result.player.name} (age ${Math.floor(result.player.age)}).`, 'success');
      this.updateDisplay();
    } else {
      this.log(`Cannot continue: ${result.error}`, 'error');
    }
  }

  listHeirs() {
    if (!this.game.kinship) { this.log('No kinship data.', 'error'); return; }
    const deadId = this.game.player?.id;
    const heirs = this.game.kinship.getEligibleHeirs(deadId).filter(id => {
      const h = this.game.kernel.entities.get(id);
      return h && h.alive && h.canSucceed();
    });
    if (heirs.length === 0) { this.log('No eligible heirs.', 'error'); return; }
    for (let i = 0; i < heirs.length; i++) {
      const h = this.game.kernel.entities.get(heirs[i]);
      this.log(`  ${i + 1}. ${h.name} (age ${Math.floor(h.age)}, ${h.occupation})`, 'info');
    }
    this.log('Use "continue <number>" to play as an heir.', 'system');
  }

  drink() {
    const player = this.game.getPlayer();
    if (!player) return;
    player.physiology.drink({ volume: 0.5, contaminated: this.game.kernel.random() < 0.1 });
    player.needs.satisfy('thirst', 0.6);
    this.game.advanceTurns(1);
    this.log('You drink some water.', 'action');
    this.updateDisplay();
  }

  toggleDevMode() {
    this.devMode = !this.devMode;
    this.log(`Developer mode ${this.devMode ? 'ON' : 'OFF'}.`, 'system');
    this.updateDisplay();
  }

  attack(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z || 0, 5);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p !== player && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    if (target.alive === false) return this.log(`${target.name} is already dead.`, 'error');
    const weapon = player.inventory?.find?.(i => i.type === 'weapon');
    const r = Combat.resolveAttack(player, target, weapon, 'torso', this.game.kernel);
    this.game.advanceTurns(1);
    if (r.hit) {
      this.log(`Hit ${target.name} for ${(r.damage*100).toFixed(0)}%.`, 'combat');
      if (target.physiology?.checkVitals && !target.physiology.checkVitals().alive && target.alive) {
        target.die('combat', this.game.kernel);
        this.log(`${target.name} has died!`, 'combat');
      }
    } else this.log(`Missed ${target.name}.`, 'combat');
  }
  craft(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const r = this.game.crafting.craft(player, args.join(' '), player.inventory, this.game.kernel);
    if (!r.success) return this.log(`Cannot craft: ${r.reason}`, 'error');
    this.game.advanceTurns(r.turnsRequired || 60);
    player.inventory.add(r.item);
    this.log(`Crafted ${r.item.type}.`, 'success');
  }
  propose(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (player.age < 16) return this.log(`You are too young to marry (${Math.floor(player.age)}). Must be 16+.`, 'error');
    if (player.marriage?.spouse) return this.log('You are already married.', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.age >= 16 && p !== player && !p.marriage?.spouse && p.alive !== false && (args[0] ? p.name.toLowerCase().includes(args[0].toLowerCase()) : true));
    if (!target) return this.log('No eligible unmarried person nearby.', 'error');
    const r = this.game.marriage.propose(player, target);
    this.game.advanceTurns(60);
    this.log(r.success ? `Married!` : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
  }
  showFamily() {
    const player = this.game.getPlayer();
    if (!player) return;
    const tree = this.game.marriage.getFamilyTree?.(player);
    if (!tree) return this.log('No family.', 'info');
    if (tree.spouse) {
      const s = this.game.kernel.entities.get(tree.spouse);
      if (s) this.log(`Spouse: ${s.name}`, 'info');
    }
    if (tree.parents?.mother) {
      const m = this.game.kernel.entities.get(tree.parents.mother);
      if (m) this.log(`Mother: ${m.name}`, 'info');
    }
    for (const cid of tree.children || []) {
      const c = this.game.kernel.entities.get(cid);
      if (c) this.log(`Child: ${c.name}`, 'info');
    }
  }
  listShops() {
    const player = this.game.getPlayer();
    if (!player) return;
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    if (!shops.length) return this.log('No shops nearby.', 'info');
    for (const s of shops) this.log(`  ${s.name}`, 'info');
  }

  // ─── Shop UI (T2-3) ─────────────────────────────────────────────────
  // Selection menu: return the entry whose `index` (1-based) the user typed.
  // Falls back to a substring match against args[0], or to the first shop.
  _pickShop(args) {
    const player = this.game.getPlayer();
    if (!player) return null;
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    if (!shops.length) { this.log('No shops nearby.', 'error'); return null; }
    if (args.length === 0) return shops[0];
    const arg = args.join(' ').toLowerCase();
    const byIndex = parseInt(arg, 10);
    if (!isNaN(byIndex) && byIndex >= 1 && byIndex <= shops.length) return shops[byIndex - 1];
    return shops.find(s => s.name.toLowerCase().includes(arg)) || shops[0];
  }

  browseShop(args) {
    const shop = this._pickShop(args);
    if (!shop) return;
    const r = this.game.trading.browseShop(shop.id);
    if (!r.success) return this.log(r.reason, 'error');
    this.log(`${shop.name}:`, 'system');
    if (!r.items.length) return this.log('  (Out of stock)', 'info');
    let i = 1;
    for (const item of r.items) {
      this.log(`  ${i}. ${item.subtype} — ${item.price} copper (${item.quantity} in stock)`, 'info');
      i++;
    }
    this.log('Use "buy <n>" or "sell <n>".', 'system');
  }

  buyItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) return this.log('Usage: buy <item-name-or-#> [qty]', 'error');
    const shop = this._pickShop([]);
    if (!shop) return;
    const browse = this.game.trading.browseShop(shop.id);
    if (!browse.success) return this.log(browse.reason, 'error');

    let item = null;
    const idx = parseInt(args[0], 10);
    if (!isNaN(idx) && idx >= 1 && idx <= browse.items.length) {
      item = browse.items[idx - 1];
    } else {
      const q = args.join(' ').toLowerCase();
      item = browse.items.find(i => i.subtype.toLowerCase().includes(q));
    }
    if (!item) return this.log('No matching item here.', 'error');
    const qty = parseInt(args[args.length - 1], 10);
    const quantity = (!isNaN(qty) && qty > 0) ? qty : 1;
    const r = this.game.trading.buyItem(player, shop.id, item.type, item.subtype, quantity);
    this.game.advanceTurns(1);
    this.log(r.success ? r.message : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
    this.updateDisplay();
  }

  sellItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) return this.log('Usage: sell <item-name-or-#> [qty]', 'error');
    const shop = this._pickShop([]);
    if (!shop) return;
    const inv = player.inventory?.items || [];
    if (!inv.length) return this.log('Inventory empty.', 'error');
    let pick = null;
    const idx = parseInt(args[0], 10);
    if (!isNaN(idx) && idx >= 1 && idx <= inv.length) pick = inv[idx - 1];
    else {
      const q = args.join(' ').toLowerCase();
      pick = inv.find(i => i.type?.toLowerCase().includes(q) || (i.subtype && i.subtype.toLowerCase().includes(q)));
    }
    if (!pick) return this.log('You don\'t have that.', 'error');
    const qty = parseInt(args[args.length - 1], 10);
    const quantity = (!isNaN(qty) && qty > 0) ? qty : 1;
    const r = this.game.trading.sellItem(player, shop.id, pick.type, pick.subtype, quantity);
    this.game.advanceTurns(1);
    this.log(r.success ? r.message : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
    this.updateDisplay();
  }

  haggleItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) return this.log('Usage: haggle <item> <target price>', 'error');
    const targetPrice = parseInt(args[args.length - 1], 10);
    if (isNaN(targetPrice)) return this.log('Bad price.', 'error');
    const itemName = args.slice(0, -1).join(' ');
    const shop = this._pickShop([]);
    if (!shop) return;
    const browse = this.game.trading.browseShop(shop.id);
    if (!browse.success) return this.log(browse.reason, 'error');
    const item = browse.items.find(i => i.subtype.toLowerCase().includes(itemName.toLowerCase()));
    if (!item) return this.log('Item not stocked here.', 'error');
    const r = this.game.trading.haggle(player, shop.id, item.type, item.subtype, targetPrice);
    this.log(r.success ? r.message : `Refused: ${r.reason}`, r.success ? 'success' : 'error');
  }

  // ─── Loans (T2-7) ──────────────────────────────────────────────────
  listLoans() {
    const player = this.game.getPlayer();
    if (!player) return;
    const loans = this.game.credit.getActiveLoansForPerson(player.id);
    if (!loans.length) return this.log('No active loans.', 'info');
    for (const l of loans) {
      this.log(`  #${l.id}: principal ${l.principal}, balance ${Math.floor(l.balance)}, ${(l.interestRate*100).toFixed(1)}%/yr`, 'info');
    }
    this.log('Use "repay <id> <amount>" to pay down a loan.', 'system');
  }

  repayLoan(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: repay <loanId> <amount>', 'error');
    const loanId = parseInt(args[0], 10);
    const amount = parseInt(args[1], 10);
    if (isNaN(loanId) || isNaN(amount) || amount <= 0) return this.log('Bad loan id or amount.', 'error');
    const r = this.game.credit.makePayment(loanId, player, amount);
    this.game.advanceTurns(1);
    if (r.success) this.log(`Repaid ${amount} — balance ${Math.floor(r.remainingBalance)}${r.fullyRepaid ? ' (cleared)' : ''}.`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
  }

  borrowMoney(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length < 2) return this.log('Usage: borrow <amount> <lenderId>', 'error');
    const amount = parseInt(args[0], 10);
    const lenderId = parseInt(args[1], 10);
    if (isNaN(amount) || amount <= 0) return this.log('Bad amount.', 'error');
    const lender = this.game.kernel.entities.get(lenderId);
    if (!lender) return this.log('No such lender.', 'error');
    const r = this.game.credit.issueLoan(lender, player, amount, { duration: 60, interestRate: 0.1 });
    this.game.advanceTurns(1);
    if (r.success) this.log(`Loaned ${amount} — total repay ${Math.floor(r.totalRepayment)}.`, 'success');
    else this.log(`Refused: ${r.reason}`, 'error');
    this.updateDisplay();
  }

  listOrphans() {
    const player = this.game.getPlayer();
    if (!player) return;
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    this.log(`Orphans nearby: ${orphans.length}. Use "adopt <n>" to adopt.`, 'system');
  }
  adoptChild(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    if (orphans.length === 0) { this.log('No orphans nearby.', 'error'); return; }
    const num = parseInt(args[0]) || 1;
    if (num < 1 || num > orphans.length) { this.log(`Pick 1-${orphans.length}.`, 'error'); return; }
    const r = this.game.marriage.adopt(player, orphans[num - 1]);
    this.game.advanceTurns(1);
    if (r.success) this.log(`Adopted ${orphans[num - 1].name}!`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
  }
  listFactions() {
    const fs = this.game.factions?.factions;
    if (!fs || fs.size === 0) { this.log('No factions. Try: form-faction <name>', 'system'); return; }
    for (const [, f] of fs) this.log(`  ${f.id}. ${f.name} [${f.purpose}]`, 'info');
  }
  formFaction(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: form-faction <name>', 'error'); return; }
    const r = this.game.factions.createFaction(args.join(' '), player, 'social', {});
    this.game.advanceTurns(1);
    if (r.success) this.log(`Faction "${args.join(' ')}" founded.`, 'success');
    this.updateDisplay();
  }
  warfareStatus() {
    const w = this.game.warfare;
    this.log(`⚔  ${w.armies.size} armies, ${w.battles.size} battles, ${w.sieges.size} sieges`, 'system');
  }
  claimLand(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) { this.log('Usage: claim-land <x> <y>', 'error'); return; }
    const r = this.game.landOwnership.registerClaim(parseInt(args[0]), parseInt(args[1]), player, 'Claim');
    this.game.advanceTurns(1);
    if (r.success) this.log(`Claim filed.`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
  }
  buyLand(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) { this.log('Usage: buy-land <x> <y>', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const sid = player.position?.settlementId ?? 0;
    const price = this.game.landOwnership.getLandPrice(x, y, sid);
    if (price === null) { this.log('No parcel there.', 'error'); return; }
    const r = this.game.landOwnership.buyLand(x, y, player, price);
    this.game.advanceTurns(1);
    if (r.success) this.log(`Bought for ${price} copper.`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
  }
  showLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const x = args[0] ? parseInt(args[0]) : player.position.x;
    const y = args[1] ? parseInt(args[1]) : player.position.y;
    const p = this.game.landOwnership.getParcel(x, y);
    if (!p) { this.log(`No parcel at (${x},${y}).`, 'info'); return; }
    this.log(`(${x},${y}): value=${p.value}, owner=${p.owner || 'unclaimed'}`, 'info');
  }
  musterArmy(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const size = parseInt(args[0]) || 5;
    const soldiers = [];
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50);
    for (const id of nearby) {
      const p = this.game.kernel.entities.get(id);
      if (p && p.alive && p.age >= 16 && p !== player) {
        soldiers.push(p);
        if (soldiers.length >= size) break;
      }
    }
    if (soldiers.length === 0) { this.log('No followers.', 'error'); return; }
    const a = this.game.warfare.musterArmy(player, soldiers, { x: player.position.x, y: player.position.y });
    this.game.advanceTurns(60);
    this.log(`Army ${a.id}: ${soldiers.length} soldiers.`, 'success');
  }
  barter(args) {
    if (args.length < 3) { this.log('Usage: barter <person> <item>=<item>', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const targetName = args[0];
    const m = `${args[1]}=${args[2]}`.match(/^([a-z]+)=([a-z]+)$/i);
    if (!m) { this.log('Format: <item>=<item>', 'error'); return; }
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(targetName.toLowerCase()) && p !== player);
    if (!target) { this.log(`No "${targetName}" nearby.`, 'error'); return; }
    const r = this.game.trading.barter(player, target, m[1].toLowerCase(), m[2].toLowerCase());
    this.game.advanceTurns(1);
    if (r.success) this.log(r.message, 'success');
    else this.log(`Refused: ${r.reason}`, 'error');
  }

  study(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const hours = parseInt(args[1]) || 4;
    this.game.education.selfStudy(player, args[0], hours, ['basic_tools']);
    this.game.advanceTurns(hours * 60);
    this.log(`Studied ${args[0]} for ${hours}h.`, 'success');
  }
  startApprenticeship(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const master = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player && p.age >= 18);
    if (!master) return;
    this.game.education.createApprenticeship(master, player, args[1], 365 * 3);
    this.game.advanceTurns(60);
    this.log(`Apprenticed to ${master.name}.`, 'success');
  }
  attemptDiscovery(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const r = this.game.technology.attemptDiscovery(player, args[0], { tools: 1 }, 'tinkering');
    this.game.advanceTurns(480);
    this.log(r?.success ? `Discovered ${args[0]}!` : `Failed.`, r?.success ? 'success' : 'error');
  }
  observePhenomenon(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    this.game.knowledge.observe(player, args.join('_'), { location: player.position });
    this.game.advanceTurns(30);
    this.log(`Observed.`, 'success');
  }
  listRecipes() {
    this.log(`Recipes: ${Object.keys(this.game.foodSystem.recipes || {}).slice(0, 8).join(', ')}`, 'system');
  }
  cook(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const r = this.game.foodSystem.cook(args.join(' '), player.inventory?.items || [], 0.5, ['fire']);
    this.game.advanceTurns(60);
    this.log(r?.success === false ? `Failed.` : `Cooked.`, r?.success === false ? 'error' : 'success');
  }
  treatDisease(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const inf = this.game.pathogens.getActiveInfections(player.id);
    if (!inf?.length) { this.log(`No infections.`, 'info'); return; }
    const r = this.game.treatment.administer(player, player, args.join(' ') || 'willow_bark', { herbs: 1 });
    this.game.advanceTurns(120);
    this.log(r?.success ? `Treated.` : `Failed.`, r?.success ? 'success' : 'error');
  }
  declareBattle(args) {
    if (args.length < 2) return this.log('Usage: declare-battle <armyId> <enemyId>', 'error');
    const r = this.game.warfare.engageBattle(parseInt(args[0]), parseInt(args[1]), args[2] || 'plains');
    this.game.advanceTurns(60);
    this.log(r.success ? `Battle ${r.battle.id}!` : `Failed.`, r.success ? 'combat' : 'error');
  }
  battleStatus() {
    const bs = this.game.warfare.getActiveBattles();
    const ss = this.game.warfare.getActiveSieges();
    if (!bs.length && !ss.length) return this.log('No battles.', 'info');
    for (const b of bs) this.log(`⚔ Battle ${b.id} round ${b.rounds.length}`, 'combat');
    for (const s of ss) this.log(`🏰 Siege ${s.id}`, 'combat');
  }
  battleRound(args) {
    const bs = this.game.warfare.getActiveBattles();
    if (!bs.length) return this.log('No battles.', 'info');
    const r = this.game.warfare.simulateBattleRound(bs[0].id);
    this.game.advanceTurns(60);
    this.log(r.success ? `Round ${r.round?.round}: casualties ${JSON.stringify(r.round?.casualties)}` : 'Failed.', 'combat');
  }
  marchArmy(args) {
    if (args.length < 3) return this.log('Usage: march <id> <x> <y>', 'error');
    this.game.warfare.march(parseInt(args[0]), { x: parseInt(args[1]), y: parseInt(args[2]) }, 10);
    this.game.advanceTurns(60);
    this.log('Marched.', 'success');
  }
  retreatArmy(args) {
    if (args.length < 1) return this.log('Usage: retreat <id>', 'error');
    this.game.warfare.retreat(parseInt(args[0]));
    this.game.advanceTurns(60);
    this.log('Retreated.', 'combat');
  }
  assaultSiege(args) {
    if (args.length < 1) return this.log('Usage: assault <siegeId>', 'error');
    this.game.warfare.assault(parseInt(args[0]));
    this.game.advanceTurns(120);
    this.log('Assault launched.', 'combat');
  }
  betrayFaction(args) {
    if (args.length < 1) return this.log('Usage: betray <factionId>', 'error');
    const player = this.game.getPlayer();
    const r = this.game.factions.betray(parseInt(args[0]), player.id, args[1] || 'personal');
    this.game.advanceTurns(60);
    this.log(r.message || (r.success ? 'Done.' : 'Failed.'), r.success ? 'combat' : 'error');
  }
  runScheme(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return;
    const own = this.game.factions.getFactionsByMember(player.id)[0];
    const r = this.game.factions.scheme(player.id, own?.id, parseInt(args[0]), args[1] || 'espionage');
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
  }
  runEspionage(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return;
    const r = this.game.politics.conductEspionage(player, parseInt(args[0]), args[1] || 'recon');
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
  }
  runCoup(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return;
    const r = this.game.politics.attemptCoup(parseInt(args[0]), player, [], args.slice(1).join(' ') || 'overthrow');
    this.game.advanceTurns(480);
    this.log(r.message, r.success ? 'combat' : 'error');
  }
  listIntrigues() {
    const b = this.game.factions.getBetrayals();
    const s = this.game.factions.getSchemes();
    const c = this.game.politics.getCoups();
    const e = this.game.politics.getEspionage();
    if (!b.length && !s.length && !c.length && !e.length) return this.log('No intrigues.', 'info');
    for (const x of b.slice(-3)) this.log(`Betrayal ${x.person}→${x.faction}`, 'combat');
    for (const x of s.slice(-3)) this.log(`Scheme ${x.type}→${x.target}`, 'combat');
    for (const x of c.slice(-3)) this.log(`Coup ${x.government} ${x.success ? 'OK' : 'fail'}`, 'combat');
    for (const x of e.slice(-3)) this.log(`Spy ${x.operation}→${x.target}`, 'combat');
  }
  stealItem(args) {
    if (args.length === 0) return this.log('Usage: steal <person>', 'error');
    const player = this.game.getPlayer();
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 5);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player);
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const r = this.game.law.attemptTheft(player, target, parseInt(args[1]) || 0);
    this.game.advanceTurns(30);
    this.log(r.message, r.success ? 'success' : 'error');
  }
  accusePerson(args) {
    if (args.length < 2) return this.log('Usage: accuse <person> <crime>', 'error');
    const player = this.game.getPlayer();
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 20);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player);
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const r = this.game.accuse(target, args[1], ['witnessed']);
    this.game.advanceTurns(60);
    this.log(r.success ? `Case ${r.case.id}.` : 'Failed.', r.success ? 'combat' : 'error');
  }
  listLaws() {
    const laws = this.game.law.getActiveLaws();
    if (!laws.length) return this.log('No laws.', 'info');
    for (const l of laws) this.log(`  ${l.id}. ${l.name}`, 'info');
  }
  listCases() {
    const player = this.game.getPlayer();
    const all = [...this.game.law.getCasesByAccused(player.id), ...this.game.law.getCasesByAccuser(player.id)];
    if (!all.length) return this.log('No cases.', 'info');
    for (const c of all) this.log(`  Case ${c.id}: ${c.crimeType}`, 'system');
  }
  enactDynamicLaw(args) {
    if (args.length === 0) return this.log('Usage: enact-law <eventType>', 'error');
    const player = this.game.getPlayer();
    const r = this.game.triggerDynamicLaw(args[0], player?.position?.settlementId);
    this.log(r.success ? `Law "${r.law.name}" enacted.` : 'Failed.', r.success ? 'success' : 'error');
  }
  startSiege(args) {
    if (args.length < 2) return this.log('Usage: siege <attackerId> <defenderId>', 'error');
    const r = this.game.warfare.startSiege(parseInt(args[0]), parseInt(args[1]), null);
    this.game.advanceTurns(60);
    this.log(r.success ? `Siege ${r.siege.id}.` : 'Failed.', r.success ? 'combat' : 'error');
  }

  showTitles() {
    const player = this.game.getPlayer();
    if (!player) return;
    const t = this.game.titles.getTitle(player);
    this.log(`Title: ${t}`, 'system');
    for (const r of this.game.titles.getTitleRanks()) {
      const e = this.game.titles.checkEligibility(player, r);
      if (e.eligible && r !== t) this.log(`  ○ ${r} (eligible)`, 'info');
    }
  }
  claimTitle(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const e = this.game.titles.checkEligibility(player, args[0]);
    if (!e.eligible) return this.log(`Not eligible: ${e.reason}`, 'error');
    const r = this.game.titles.grant(player, args[0]);
    this.game.advanceTurns(60);
    this.log(r.success ? `Now ${args[0]}.` : 'Failed.', r.success ? 'success' : 'error');
  }
  showHouse() {
    const player = this.game.getPlayer();
    if (!player) return;
    const h = this.game.titles.getHouseForPerson(player.id);
    this.log(h ? `${h.name} — ${h.members.length} members` : 'No house.', 'system');
  }
  raiseLevy(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.titles.raiseLevy(player, parseInt(args[0]) || 10);
    this.log(r.message, 'success');
  }
  holdCourt() {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.titles.holdCourt(player);
    this.game.advanceTurns(240);
    this.log(r.success ? 'Court held.' : 'Failed.', r.success ? 'success' : 'error');
  }
  listSpells() {
    const player = this.game.getPlayer();
    if (!player) return;
    this.log(`Spells: ${this.game.magic.getKnownSpells(player).join(', ') || '(none)'}`, 'system');
  }
  learnSpellCmd(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const r = this.game.magic.learnSpell(player, args[0], 8);
    this.game.advanceTurns(480);
    this.log(r.success ? `Learned ${args[0]}.` : `Failed.`, r.success ? 'success' : 'error');
  }
  castSpellCmd(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return;
    const r = this.game.magic.cast(player, args[0], player);
    this.game.advanceTurns(30);
    this.log(r.success ? `Cast.${r.backlash ? ' (backlash!)' : ''}` : 'Failed.', r.success ? 'success' : 'error');
  }
  showMana() {
    const player = this.game.getPlayer();
    if (!player) return;
    const pool = this.game.magic.getPool(player);
    this.log(`Mana: ${Math.floor(pool.current)}/${pool.max}`, 'system');
  }

  // ─── Religion ──────────────────────────────────────────────────────
  pray(args) { const player = this.game.getPlayer(); if (!player) return; this.game.religion?.pray?.(player, parseInt(args[0]) || 0, args[1] || 'private'); this.game.advanceTurns(15); this.log('Prayed.', 'success'); }
  makeOffering(args) { const player = this.game.getPlayer(); if (!player || args.length === 0) return; this.game.religion?.makeOffering?.(player, 0, { type: args[0].toLowerCase(), item: args[0] }); this.game.advanceTurns(10); this.log('Offered.', 'success'); }
  performRitual(args) { const player = this.game.getPlayer(); if (!player) return; this.game.religion?.performRitual?.(player, args[0] || 'prayer', []); this.game.advanceTurns(60); this.log('Ritual done.', 'success'); }
  showProphecy() { const p = this.game.religion?.prophecies || []; this.log(p.length ? `"${p[p.length-1].text}"` : 'No prophecies.', p.length ? 'system' : 'info'); }
  listTemples() { const t = this.game.religion?.temples ? [...this.game.religion.temples.values()] : []; this.log(`${t.length} temples.`, 'system'); }
  listClergy() { const c = this.game.religion?.clergy ? [...this.game.religion.clergy.values()] : []; this.log(`${c.length} clergy.`, 'system'); }
  ordainClergy(args) { const player = this.game.getPlayer(); if (!player) return; const candidate = args[0] ? this.game.kernel.entities.get(parseInt(args[0])) : player; if (!candidate || candidate.alive === false) return this.log('No valid candidate.', 'error'); const rank = args[1] || 'priest'; const r = this.game.religion?.ordainClergy?.(candidate, rank); this.log(r?.success ? `Ordained ${candidate.name} as ${rank}.` : `Ordination failed${r?.reason ? ': '+r.reason : ''}.`, r?.success ? 'success' : 'error'); }
  blessFollower(args) { const player = this.game.getPlayer(); if (!player) return; const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10); const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.alive !== false && args[0] && p.name.toLowerCase().includes(args[0].toLowerCase())); if (target) { target.morale = Math.min(1, (target.morale || 0.5) + 0.2); this.log(`Blessed ${target.name}.`, 'success'); } else this.log('No living follower by that name.', 'error'); }
  exorcise() { this.game.advanceTurns(120); this.log('Rites performed.', 'info'); }
  goPilgrimage(args) { const player = this.game.getPlayer(); if (!player || args.length === 0) return; const t = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase())); if (t) { player.position.x = t.x; player.position.y = t.y; this.game.advanceTurns(60); this.log(`Pilgrimage to ${t.name}.`, 'success'); } else this.log('No such settlement.', 'error'); }
  sacrifice(args) { this.log('Sacrificed.', 'success'); }

  // ─── Transportation ────────────────────────────────────────────────
  mountHorse(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.transportation?.mountVehicle?.(player, parseInt(args[0])); this.log(r?.success ? `Mounted.` : `Failed.`, r?.success ? 'success' : 'error'); }
  dismount() { const player = this.game.getPlayer(); if (!player) return; const r = this.game.transportation?.dismount?.(player); this.log(r?.success ? 'Dismounted.' : 'Failed.', r?.success ? 'success' : 'error'); }
  sailTo(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.transportation?.sail?.(player, parseInt(args[0]), parseInt(args[1])); if (r?.success) this.game.advanceTurns(r.ticks); this.log(r?.success ? `Sailed ${r.distance.toFixed(1)} tiles.` : `Failed.`, r?.success ? 'success' : 'error'); }
  driveCart(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.transportation?.drive?.(player, parseInt(args[0]), parseInt(args[1])); if (r?.success) this.game.advanceTurns(r.ticks); this.log(r?.success ? `Drove ${r.distance.toFixed(1)} tiles.` : `Failed.`, r?.success ? 'success' : 'error'); }
  listVehicles() { const v = this.game.transportation ? [...this.game.transportation.vehicles.values()] : []; this.log(`${v.length} vehicles.`, 'system'); }
  listStables() { const player = this.game.getPlayer(); if (!player) return; const sid = player.position?.settlementId ?? 0; const s = this.game.transportation?.getStable?.(sid) || []; this.log(`${s.length} vehicles at this stable.`, 'system'); }
  travelTo(args) { const player = this.game.getPlayer(); if (!player) return; const t = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase())); if (!t) return this.log('No settlement.', 'error'); const dx = t.x - player.position.x; const dy = t.y - player.position.y; const r = this.game.transportation?.travel?.(player, dx, dy); if (r?.success) { this.game.advanceTurns(r.ticks); this.log(`Traveled to ${t.name}.`, 'success'); } else this.log('Failed.', 'error'); }
  fastTravel(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.transportation?.fastTravel?.(player, args[0]); this.log(r?.success ? 'Fast-traveled.' : 'Failed.', r?.success ? 'success' : 'error'); }

  // ─── Governance ────────────────────────────────────────────────────
  holdElection(args) { const player = this.game.getPlayer(); if (!player) return; const candidates = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50).map(id => this.game.kernel.entities.get(id)).filter(p => p && p.alive && p.age >= 25).slice(0, 5); if (!candidates.length) return this.log('No candidates.', 'error'); const r = this.game.politics?.holdElection?.(parseInt(args[0]), candidates); this.game.advanceTurns(60); this.log(r?.success ? 'Election held.' : 'Failed.', r?.success ? 'success' : 'error'); }
  coronate(args) { const player = this.game.getPlayer(); if (!player) return; if (player.alive === false) return this.log('Dead monarchs cannot be crowned.', 'error'); const targetId = parseInt(args[0]); if (targetId) { const t = this.game.kernel.entities.get(targetId); if (t && t.alive === false) return this.log('That target is dead.', 'error'); } const r = this.game.politics?.coronate?.(targetId, player); this.game.advanceTurns(120); this.log(r?.success ? '👑 Crowned.' : 'Failed.', r?.success ? 'success' : 'error'); }
  abdicateThrone() { const player = this.game.getPlayer(); if (!player) return; const gov = [...this.game.politics.governments.values()].find(g => g.ruler === player.id); if (!gov) return this.log('You rule nothing.', 'error'); this.game.politics.abdicate(gov.id, player, null); this.game.advanceTurns(120); this.log('Abdicated.', 'system'); }
  appointRegent(args) { const player = this.game.getPlayer(); if (!player) return; const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10); const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && args[0] && p.name.toLowerCase().includes(args[0].toLowerCase())); if (!target) return this.log('Not found.', 'error'); const gov = [...this.game.politics.governments.values()].find(g => g.ruler === player.id); if (!gov) return this.log('You rule nothing.', 'error'); this.game.politics.appointRegent(gov.id, target); this.game.advanceTurns(60); this.log('Regent set.', 'success'); }
  showDynasty() { const player = this.game.getPlayer(); if (!player) return; const d = this.game.politics?.getDynasty?.(player.dynasty); this.log(d ? `${d.name} — ${d.monarchs.length} monarchs` : 'No dynasty.', d ? 'system' : 'info'); }
  proposeLawCmd(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.triggerDynamicLaw('plague_outbreak', player.position?.settlementId); this.log(r?.success ? 'Law proposed.' : 'Failed.', r?.success ? 'success' : 'error'); }
  signTreaty(args) { const player = this.game.getPlayer(); if (!player) return; const r = this.game.politics?.signTreaty?.(parseInt(args[0]), parseInt(args[1])); this.log(r?.success ? 'Treaty signed.' : 'Failed.', r?.success ? 'success' : 'error'); }
  ratifyTreaty(args) { const t = this.game.politics?.treaties?.get?.(args[0]); if (!t) return this.log('No treaty.', 'error'); t.active = true; this.log('Ratified.', 'success'); }
  makeVassal(args) { const r = this.game.politics?.makeVassal?.(parseInt(args[0]), parseInt(args[1])); this.log(r?.success ? 'Vassalage set.' : 'Failed.', r?.success ? 'success' : 'error'); }
  holdCouncil(args) { const player = this.game.getPlayer(); if (!player) return; const gov = this.game.politics.governments.get(parseInt(args[0])); if (!gov) return this.log('No such government.', 'error'); const voters = (gov.subjects || []).slice(0, 8).map(id => this.game.kernel.entities.get(id)).filter(Boolean); const r = this.game.politics.holdCouncilSession(gov.id, args.slice(1).join(' '), voters); this.game.advanceTurns(120); this.log(`Council: ${r.session.passed ? 'PASSED' : 'FAILED'}.`, r.session.passed ? 'success' : 'error'); }

  getSlopeDescription(slope) { return slope > 10 ? '(steep)' : '(gentle)'; }
  getTempDescription(temp) { return temp > 25 ? '(warm)' : temp > 10 ? '(mild)' : '(cold)'; }
  getHumidityDescription(hum) { return hum > 70 ? '(humid)' : hum > 40 ? '(moderate)' : '(dry)'; }
  getHungerDescription(hunger) { return hunger > 0.7 ? 'Starving' : hunger > 0.4 ? 'Hungry' : 'Satisfied'; }
  getThirstDescription(thirst) { return thirst > 0.7 ? 'Parched' : thirst > 0.4 ? 'Thirsty' : 'Hydrated'; }
  getSleepDescription(sleep) { return sleep > 0.7 ? 'Exhausted' : sleep > 0.4 ? 'Tired' : 'Rested'; }
  getPainDescription(pain) { return pain > 6 ? 'Severe pain' : pain > 3 ? 'Moderate pain' : 'Minimal pain'; }
  getFatigueDescription(fatigue) { return fatigue > 0.7 ? 'Exhausted' : fatigue > 0.4 ? 'Fatigued' : 'Energetic'; }
  getSkillLevel(value) { return value > 0.8 ? 'Expert' : value > 0.6 ? 'Skilled' : value > 0.4 ? 'Competent' : 'Novice'; }
  getItemColor(item) { return item.quality === 'excellent' ? 'green' : item.quality === 'poor' ? 'red' : 'white'; }
  getOccupationColor(occ) { return occ === 'merchant' ? 'yellow' : occ === 'warrior' ? 'red' : 'white'; }

  gatherResource(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const resources = tile?.resources || [];
    if (resources.length === 0) return this.log('Nothing to gather here.', 'error');
    const pick = args.length > 0 ? resources.find(r => (r.type + ' ' + (r.subtype || '')).includes(args.join(' '))) : resources[0];
    if (!pick) return this.log(`No ${args.join(' ')} here.`, 'error');
    if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
    const item = { type: pick.type, subtype: pick.subtype || pick.type, mass: 0.5 };
    const r = player.inventory.add(item);
    if (r && r.success === false) return this.log('Inventory full.', 'error');
    pick.extracted = (pick.extracted || 0) + 1;
    this.game.advanceTurns(8);
    this.log(`Gathered 1 ${item.subtype}.`, 'success');
    if (player.skills?.train) player.skills.train('foraging', 'survival', 0.5, 8);
  }

  huntAnimal(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const tileKey = `${player.position.x},${player.position.y}`;
    const faunaIds = this.game.naturalWorld.faunaByTile.get(tileKey) || [];
    if (!faunaIds.length) return this.log('No animals here.', 'error');
    const skill = (player.skills?.physical?.hunting?.level || 0) / 100;
    const r = this.game.naturalWorld.huntAnimal(faunaIds[0], skill);
    if (r.success) {
      if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
      for (const item of (r.yield || [])) player.inventory.add(item);
      this.game.advanceTurns(5);
      this.log('Hunted successfully!', 'success');
    } else this.log(r.reason || 'Hunt failed.', 'error');
  }

  harvestFlora(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const tileKey = `${player.position.x},${player.position.y}`;
    const floraIds = this.game.naturalWorld.floraByTile.get(tileKey) || [];
    const plants = floraIds.map(id => this.game.naturalWorld.flora.get(id)).filter(f => f && f.harvestable);
    if (!plants.length) return this.log('Nothing to harvest.', 'error');
    const r = this.game.naturalWorld.harvestFlora(plants[0].id);
    if (r.success) {
      if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
      for (const item of (r.yield || [])) player.inventory.add(item);
      this.game.advanceTurns(5);
      this.log(`Harvested ${r.species}.`, 'success');
    } else this.log(r.reason || 'Harvest failed.', 'error');
  }

  plantCrop(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: plant <crop>', 'error');
    if (!this.game.agriculture?.plant) return this.log('Agriculture unavailable.', 'error');
    const crop = args.join(' ').toLowerCase();
    const r = this.game.agriculture.plant(player.position.x, player.position.y, crop);
    if (r.success) {
      this.game.advanceTurns(30);
      this.log(`Planted ${crop}.`, 'success');
    } else this.log(r.reason || 'Could not plant.', 'error');
  }

  gossip(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const peer = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10)
      .map(id => this.game.kernel.entities.get(id))
      .find(p => p && p !== player && p.alive && p.age >= 12 && p.name);
    if (!peer) return this.log('No one nearby.', 'error');
    if (!this.game.reputation?.makeClaim) return this.log('Reputation unavailable.', 'error');
    let subject = args.length > 0 ? this.game.kernel.entities.get(parseInt(args[0], 10)) : null;
    if (!subject) subject = Array.from(this.game.kernel.alivePeople || []).find(p => p && p !== player && p !== peer);
    if (!subject) return this.log('No one to gossip about.', 'error');
    const claim = this.game.reputation.makeClaim(player, subject, 'honest', 0.5 + this.game.kernel.random() * 0.3, { type: 'witnessed' });
    const r = claim ? this.game.reputation.propagateClaim(claim.id, player, peer, { medium: 'conversation' }) : null;
    if (r && r.success) {
      this.game.advanceTurns(5);
      this.log(`Gossiped with ${peer.name} about ${subject.name}.`, 'success');
    } else this.log('Gossip failed.', 'error');
  }
}
