/**
 * DEPRECATED: kept as a thin readline-based wrapper for backwards compatibility.
 * New code should use `BlessedGameUI` (default) or `EnhancedGameUI` (richer features).
 *
 * The original GameUI.js was a minimal readline UI with several stubbed
 * commands (`take`, `drop`, `talk`, `load` printed "...not yet implemented.").
 * Rather than silently keeping misleading stubs, this file now provides a
 * working implementation of those missing commands on top of the same
 * readline loop.
 */
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { Combat } from '../systems/Combat.js';
import { performQuit } from './quitConfirm.js';

export class GameUI {
  constructor(game) {
    this.game = game;
    this.groundItems = new Map();
    this.devMode = false;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
  }

  start() {
    this.showWelcome();
    this.rl.prompt();
    this.rl.on('line', (input) => {
      this.handleInput(input.trim());
      this.rl.prompt();
    });
    this.rl.on('close', () => process.exit(0));
  }

  showWelcome() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║        MEDIEVAL LIFE SIMULATION                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Type "help" for commands, "start" to begin a new life\n');
  }

  handleInput(input) {
    if (!input) return;
    const [command, ...args] = input.toLowerCase().split(' ');
    const commands = {
      'help': () => this.showHelp(),
      'start': () => this.startNewLife(),
      'look': () => this.look(),
      'status': () => this.showStatus(),
      'inventory': () => this.showInventory(),
      'move': () => this.move(args),
      'take': () => this.take(args),
      'drop': () => this.drop(args),
      'eat': () => this.eat(args),
      'drink': () => this.drink(),
      'sleep': () => this.sleep(),
      'work': () => this.work(),
      'craft': () => this.craft(args),
      'talk': () => this.talk(args),
      'propose': () => this.propose(args),
      'family': () => this.showFamily(),
      'shop': () => this.listShops(),
      'attack': () => this.attack(args),
      'wait': () => this.wait(args),
      'dev': () => this.toggleDevMode(),
      'save': () => this.save(),
      'load': () => this.load(),
      'continue': () => this.continueAsHeir(args),
      'heirs': () => this.listHeirs(),
      'quit': () => this._confirmQuit()
    };
    if (commands[command]) {
      try { commands[command](); }
      catch (e) { console.log(`Error: ${e.message}`); }
    } else {
      console.log(`Unknown command: ${command}. Type "help" for available commands.`);
    }
  }

  showHelp() {
    console.log('\n=== COMMANDS ===');
    console.log('  start           - Begin a new life');
    console.log('  look            - Examine surroundings');
    console.log('  status          - View character status');
    console.log('  inventory       - View inventory');
    console.log('  move <dir>      - Move (north/south/east/west)');
    console.log('  take <item>     - Pick up item');
    console.log('  drop <item>     - Drop item');
    console.log('  eat <item>      - Consume food');
    console.log('  drink           - Drink water');
    console.log('  sleep           - Rest and sleep');
    console.log('  work            - Perform occupation work');
    console.log('  craft <recipe>  - Craft item');
    console.log('  talk <person>   - Interact with person');
    console.log('  propose <name>  - Propose marriage');
    console.log('  family          - View family tree');
    console.log('  shop            - List nearby shops');
    console.log('  attack <target> - Attack target');
    console.log('  wait [turns]    - Pass time');
    console.log('  continue <n>    - Continue as nth heir (after death)');
    console.log('  heirs           - List eligible heirs');
    console.log('  dev             - Toggle developer mode');
    console.log('  save            - Save game');
    console.log('  load            - Load game');
    console.log('  quit            - Exit game\n');
  }

  startNewLife() {
    if (this.game.player) { console.log('You already have an active life.'); return; }
    this.rl.question('Name: ', (name) => {
      this.rl.question('Sex (male/female): ', (sex) => {
        const result = this.game.createPlayer(name, sex.toLowerCase());
        if (result.success) {
          console.log(`\nYou are born as ${name}, a ${sex} child in ${result.settlement.name}.`);
          console.log('Your life begins...\n');
          this.look();
        } else {
          console.log(`Failed: ${result.error}`);
        }
      });
    });
  }

  look() {
    const player = this.game.getPlayer();
    if (!player) { console.log('No active character. Use "start" to begin.'); return; }
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);
    console.log(`\n=== ${tile.biome.type.toUpperCase()} ===`);
    console.log(`Elevation: ${Math.floor(tile.terrain.elevation)}m | Temp: ${Math.floor(tile.climate.temperature)}°C`);
    if (nearby.length > 1) {
      console.log('\nNearby:');
      for (const id of nearby) {
        if (id === player.id) continue;
        const entity = this.game.kernel.entities.get(id);
        if (entity && entity.name) console.log(`  - ${entity.name} (${entity.occupation || 'person'})`);
      }
    }
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length > 0) {
      console.log('\nItems on ground:');
      for (const item of groundItems) console.log(`  - ${item.type}${item.subtype ? ` (${item.subtype})` : ''}`);
    }
  }

  showStatus() {
    const player = this.game.getPlayer();
    if (!player) return;
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    console.log(`\n=== ${status.name.toUpperCase()} ===`);
    console.log(`Age: ${status.age} | Sex: ${status.sex} | Job: ${status.occupation}`);
    console.log(`Health: ${(health.overall*100).toFixed(0)}% | Pain: ${health.pain.toFixed(1)}/10 | Fatigue: ${(health.fatigue*100).toFixed(0)}%`);
    console.log(`Hunger: ${(status.needs.hunger*100).toFixed(0)}% | Thirst: ${(status.needs.thirst*100).toFixed(0)}% | Sleep: ${(status.needs.sleep*100).toFixed(0)}%`);
  }

  showInventory() {
    const player = this.game.getPlayer();
    if (!player) return;
    console.log(`\nWeight: ${player.inventory.getWeight().toFixed(1)}/${player.inventory.capacity}kg`);
    if (player.inventory.items.length === 0) { console.log('Empty'); return; }
    for (const item of player.inventory.items) {
      console.log(`  - ${item.type}${item.subtype ? ` (${item.subtype})` : ''} [${item.mass}kg]`);
    }
  }

  move(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const dir = args[0];
    const dirs = { north:[0,-1], n:[0,-1], south:[0,1], s:[0,1], east:[1,0], e:[1,0], west:[-1,0], w:[-1,0] };
    if (!dirs[dir]) { console.log('Invalid direction. Use: north/south/east/west (n/s/e/w)'); return; }
    player.position.x += dirs[dir][0];
    player.position.y += dirs[dir][1];
    this.game.kernel.entityIndex.update(player);
    this.game.advanceTurns(1);
    console.log(`You move ${dir}.`);
    this.look();
  }

  take(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length === 0) { console.log('Nothing here to take.'); return; }
    let item;
    if (args.length === 0) {
      console.log('Items here:');
      groundItems.forEach((it, i) => console.log(`  ${i+1}. ${it.type}${it.subtype ? ` (${it.subtype})` : ''}`));
      this.rl.question('Take which? (number or blank to cancel): ', (answer) => {
        const idx = parseInt(answer) - 1;
        if (isNaN(idx) || idx < 0 || idx >= groundItems.length) { console.log('Cancelled.'); return; }
        this._pickup(player, groundItems, idx, locKey);
      });
      return;
    }
    const name = args.join(' ').toLowerCase();
    const idx = groundItems.findIndex(i => i.type.toLowerCase().includes(name) || (i.subtype && i.subtype.toLowerCase().includes(name)));
    if (idx === -1) { console.log(`No "${args.join(' ')}" here.`); return; }
    this._pickup(player, groundItems, idx, locKey);
  }

  _pickup(player, groundItems, idx, locKey) {
    const item = groundItems[idx];
    if (player.inventory.getWeight() + item.mass > player.inventory.capacity) {
      console.log(`Too heavy (${(player.inventory.getWeight()+item.mass).toFixed(1)}/${player.inventory.capacity}kg).`);
      return;
    }
    groundItems.splice(idx, 1);
    if (groundItems.length === 0) this.groundItems.delete(locKey);
    else this.groundItems.set(locKey, groundItems);
    player.inventory.add(item);
    this.game.advanceTurns(1);
    console.log(`You pick up the ${item.type}.`);
  }

  drop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (player.inventory.items.length === 0) { console.log('Inventory empty.'); return; }
    let item;
    if (args.length === 0) {
      console.log('Inventory:');
      player.inventory.items.forEach((it, i) => console.log(`  ${i+1}. ${it.type}${it.subtype ? ` (${it.subtype})` : ''}`));
      this.rl.question('Drop which? (number or blank to cancel): ', (answer) => {
        const idx = parseInt(answer) - 1;
        if (isNaN(idx) || idx < 0 || idx >= player.inventory.items.length) { console.log('Cancelled.'); return; }
        this._dropItem(player, idx);
      });
      return;
    }
    const name = args.join(' ').toLowerCase();
    const idx = player.inventory.items.findIndex(i => i.type.toLowerCase().includes(name) || (i.subtype && i.subtype.toLowerCase().includes(name)));
    if (idx === -1) { console.log(`No "${args.join(' ')}" in inventory.`); return; }
    this._dropItem(player, idx);
  }

  _dropItem(player, idx) {
    const item = player.inventory.items[idx];
    player.inventory.remove(item.type, 1);
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    groundItems.push(item);
    this.groundItems.set(locKey, groundItems);
    this.game.advanceTurns(1);
    console.log(`You drop the ${item.type}.`);
  }

  eat(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const name = args.join(' ') || 'food';
    const food = player.inventory.find(i => i.type === name || i.subtype === name);
    if (!food) { console.log(`You don't have any ${name}.`); return; }
    player.physiology.consume(food);
    player.inventory.remove(food.type, 1);
    player.needs.satisfy('hunger', 0.5);
    this.game.advanceTurns(1);
    console.log(`You eat the ${food.type}.`);
  }

  drink() {
    const player = this.game.getPlayer();
    if (!player) return;
    player.physiology.drink({ volume: 0.5, contaminated: this.game.kernel.random() < 0.1 });
    player.needs.satisfy('thirst', 0.6);
    this.game.advanceTurns(1);
    console.log('You drink some water.');
  }

  sleep() {
    const player = this.game.getPlayer();
    if (!player) return;
    console.log('You sleep...');
    this.game.advanceTurns(480);
    player.needs.satisfy('sleep', 1.0);
    player.physiology.fatigue = 0;
    console.log('You wake up refreshed.');
  }

  work() {
    const player = this.game.getPlayer();
    if (!player) return;
    console.log(`You work as a ${player.occupation}...`);
    this.game.advanceTurns(480);
    const household = this.game.kernel.entities.get(player.household);
    if (household) {
      const productivity = player.skills.knowledge.agriculture * player.physiology.getHealthStatus().strength;
      household.addWealth(productivity * 10);
      household.food += productivity * 5;
      console.log(`Earned ${(productivity*10).toFixed(0)} wealth for household.`);
    }
  }

  craft(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const recipe = args.join(' ');
    const result = this.game.crafting.craft(player, recipe, player.inventory, this.game.kernel);
    if (result.success) {
      console.log(`Crafting ${recipe}... (${result.turnsRequired} turns)`);
      this.game.advanceTurns(result.turnsRequired);
      player.inventory.add(result.item);
      console.log(`Crafted ${result.item.type}!`);
    } else {
      console.log(`Cannot craft: ${result.reason}`);
    }
  }

  talk(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);
    const people = nearby.map(id => this.game.kernel.entities.get(id)).filter(e => e && e.name && e.id !== player.id);
    if (people.length === 0) { console.log('No one nearby to talk to.'); return; }
    let target;
    if (args.length === 0) {
      console.log('People nearby:');
      people.forEach((p, i) => console.log(`  ${i+1}. ${p.name} (${p.occupation})`));
      this.rl.question('Talk to whom? (number or name): ', (answer) => {
        const num = parseInt(answer);
        if (!isNaN(num) && num >= 1 && num <= people.length) {
          this._converse(player, people[num-1]);
        } else {
          const name = answer.toLowerCase();
          const t = people.find(p => p.name.toLowerCase().includes(name));
          if (t) this._converse(player, t);
          else console.log('Not found.');
        }
      });
      return;
    }
    const name = args.join(' ').toLowerCase();
    target = people.find(p => p.name.toLowerCase().includes(name));
    if (!target) { console.log(`No one named "${args.join(' ')}" nearby.`); return; }
    this._converse(player, target);
  }

  _converse(player, target) {
    const bond = this.game.relationships.getBond(player.id, target.id);
    const kinship = this.game.kinship.getRelationship(player.id, target.id);
    if (!bond) this.game.relationships.createBond(player.id, target.id, 0.1);
    else this.game.relationships.modifyAffinity(player.id, target.id, 0.05);
    this.game.advanceTurns(1);
    console.log(`You approach ${target.name}.`);
    if (kinship) console.log(`${target.name}: "Hello, ${kinship}!"`);
    else if (bond && bond.affection > 0.5) console.log(`${target.name}: "Good to see you, friend!"`);
    else console.log(`${target.name}: "Greetings, traveler."`);
  }

  propose(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);
    const people = nearby.map(id => this.game.kernel.entities.get(id)).filter(e => e && e.name && e.id !== player.id && e.age >= 16);
    if (people.length === 0) { console.log('No eligible people nearby.'); return; }
    const name = args.join(' ').toLowerCase();
    const target = people.find(p => p.name.toLowerCase().includes(name));
    if (!target) { console.log(`No one named "${args.join(' ')}" nearby.`); return; }
    const result = this.game.marriage.propose(player, target);
    this.game.advanceTurns(1);
    console.log(result.success ? `Married ${target.name}!` : `Proposal failed: ${result.reason}`);
  }

  showFamily() {
    const player = this.game.getPlayer();
    if (!player) return;
    const tree = this.game.marriage.getFamilyTree(player);
    console.log(`\n=== FAMILY OF ${player.name.toUpperCase()} ===`);
    if (tree.spouse) {
      const s = this.game.kernel.entities.get(tree.spouse);
      if (s) console.log(`Spouse: ${s.name} (${Math.floor(s.age)})`);
    } else {
      console.log('Spouse: none');
    }
    if (tree.parents.mother) {
      const m = this.game.kernel.entities.get(tree.parents.mother);
      if (m) console.log(`Mother: ${m.name} (${Math.floor(m.age)})`);
    }
    if (tree.parents.father) {
      const f = this.game.kernel.entities.get(tree.parents.father);
      if (f) console.log(`Father: ${f.name} (${Math.floor(f.age)})`);
    }
    if (tree.children.length > 0) {
      console.log('Children:');
      for (const cid of tree.children) {
        const c = this.game.kernel.entities.get(cid);
        if (c) console.log(`  - ${c.name} (${Math.floor(c.age)}, ${c.sex})`);
      }
    }
  }

  listShops() {
    const player = this.game.getPlayer();
    if (!player) return;
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    if (shops.length === 0) { console.log('No shops nearby.'); return; }
    console.log('\nNearby shops:');
    shops.forEach((s, i) => console.log(`  ${i+1}. ${s.name} (${s.type})`));
  }

  attack(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 5);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(e => e && e.name && e.name.toLowerCase().includes(args.join(' ').toLowerCase()));
    if (!target) { console.log('Target not found nearby.'); return; }
    const weapon = player.inventory.find(i => i.type === 'weapon');
    const result = Combat.resolveAttack(player, target, weapon, 'torso', this.game.kernel);
    this.game.advanceTurns(1);
    if (result.hit) console.log(`Hit ${target.name} in the ${result.location} for ${(result.damage*100).toFixed(0)}% damage.`);
    else console.log(`You miss ${target.name}.`);
  }

  wait(args) {
    const turns = parseInt(args[0]) || 1;
    this.game.advanceTurns(turns);
    console.log(`${turns} minute(s) pass...`);
  }

  toggleDevMode() { this.devMode = !this.devMode; console.log(`Developer mode: ${this.devMode ? 'ON' : 'OFF'}`); }

  async _confirmQuit() {
    if (this._quitConfirmPending) return;
    this._quitConfirmPending = true;
    try {
      const answer = await performQuit(this);
      if (answer === 'save-exit' || answer === 'exit-on-save-fail' || answer === 'exit') {
        try { this.rl.close(); } catch (_) {}
      } else if (answer === 'cancel') {
        try { this.rl.prompt(); } catch (_) {}
      }
    } finally {
      this._quitConfirmPending = false;
    }
  }

  save() {
    try {
      const saveData = this.game.save();
      const saveDir = path.join(process.cwd(), 'saves');
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `save_${this.game.player?.name || 'unknown'}_${ts}.json`;
      fs.writeFileSync(path.join(saveDir, filename), JSON.stringify(saveData, null, 2));
      console.log(`Saved: ${filename}`);
    } catch (e) { console.log(`Save failed: ${e.message}`); }
  }

  load() {
    try {
      const saveDir = path.join(process.cwd(), 'saves');
      if (!fs.existsSync(saveDir)) { console.log('No saves directory.'); return; }
      const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) { console.log('No save files.'); return; }
      const latest = files.sort().reverse()[0];
      const data = JSON.parse(fs.readFileSync(path.join(saveDir, latest), 'utf8'));
      const result = this.game.load(data);
      if (result.success) console.log(`Loaded: ${latest}`);
      else console.log(`Load failed: ${result.error}`);
    } catch (e) { console.log(`Load failed: ${e.message}`); }
  }

  continueAsHeir(args) {
    const idx = parseInt(args[0]) || 0;
    const result = this.game.continueAsHeir(idx);
    if (result.success) console.log(`You are now ${result.player.name} (age ${Math.floor(result.player.age)}).`);
    else console.log(`Cannot continue: ${result.error}`);
  }

  listHeirs() {
    const deadId = this.game.player?.id;
    const heirs = this.game.kinship.getEligibleHeirs(deadId).filter(id => {
      const h = this.game.kernel.entities.get(id);
      return h && h.alive && h.canSucceed();
    });
    if (heirs.length === 0) { console.log('No eligible heirs.'); return; }
    heirs.forEach((id, i) => {
      const h = this.game.kernel.entities.get(id);
      console.log(`  ${i+1}. ${h.name} (age ${Math.floor(h.age)}, ${h.occupation})`);
    });
    console.log('Use "continue <number>" to play as an heir.');
  }
}