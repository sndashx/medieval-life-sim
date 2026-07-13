import blessed from 'blessed';
import contrib from 'blessed-contrib';
import fs from 'fs';
import path from 'path';
import {
  C as Color,
  G as Glyph,
  BORDERS,
  BIOME,
  ITEM_CATEGORY,
  SLOT_GLYPH,
  bar as themeBar,
  WELCOME_ART,
  WELCOME_ART_COMPACT,
  WELCOME_LORE,
  formatGameTime,
} from './theme.js';
import { GameQuery } from '../core/GameQuery.js';
import { Combat } from '../systems/Combat.js';

const FOCUSABLE_PANELS = [
  'map', 'location', 'status', 'sparklines', 'factions',
  'skills', 'inventory', 'equipment', 'feed', 'command',
];

export class BlessedGameUI {
  constructor(game) {
    this.game = game;
    this.query = new GameQuery(game);
    this.groundItems = new Map();

    this.compactMode = (process.stdout.columns || 80) < 100
      || (process.stdout.rows || 24) < 28;

    this._sparkSamples = { hunger: [], thirst: [], sleep: [], energy: [], health: [] };
    this._sparkMax = 40;
    this._mapCache = { turn: -1, content: '' };
    this._commandHistory = [];
    this._commandHistoryIdx = -1;
    this._commandList = [];
    this._focusIdx = FOCUSABLE_PANELS.indexOf('command');
    this._tickTimer = null;
    this._welcomeActive = false;
    this._helpOverlay = null;
    this._heirPicker = null;
    this._creationWizard = null;

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Medieval Life — A Chronicle',
      fullUnicode: true,
      dockBorders: true,
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'white'
      },
    });

    this.setupUI();
    this.setupKeybindings();
    this._refreshFocus();

    if (typeof this.game.registerUIListener === 'function') {
      this._unregisterUI = this.game.registerUIListener((msg, type) => this.log(msg, type || 'system'));
    }
  }

  setupUI() {
    if (this.compactMode) {
      this._setupCompactUI();
    } else {
      this._setupFullUI();
    }
    this.screen.render();
  }

  _setupFullUI() {
    const cols = 24, rows = 24;
    this.grid = new contrib.grid({ rows, cols, screen: this.screen });

    const panelBorder = {
      type: BORDERS.round,
      style: { fg: Color.gold },
      bold: true,
      ch: '─',
    };
    const panelLabel = `{${Color.gold}-fg}${Glyph.fleur}  %s  {/${Color.gold}-fg}`;
    const baseStyle = { fg: Color.parchment, border: { fg: Color.gold } };

    this.headerBox = this.grid.set(0, 0, 1, cols, blessed.box, {
      tags: true,
      align: 'center',
      style: { fg: Color.goldBright, bg: Color.oxblood, bold: true },
      content: ' ',
    });

    this.mapPanel = this.grid.set(1, 0, 10, 14, blessed.box, {
      label: panelLabel.replace('%s', 'Realm'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });
    this.locationBox = this.grid.set(1, 14, 10, 10, blessed.box, {
      label: panelLabel.replace('%s', 'Location & Nearby'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });

    this.statusBox = this.grid.set(11, 0, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', 'Status'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });
    this.sparkPanel = this.grid.set(11, 8, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', 'Vitals Trend'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
    });
    this.factionsPanel = this.grid.set(11, 16, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', 'Factions'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });

    this.skillsPanel = this.grid.set(14, 0, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', 'Skills'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });
    this.inventoryPanel = this.grid.set(14, 8, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', `${Glyph.bag} Inventory`),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });
    this.equipmentPanel = this.grid.set(14, 16, 3, 8, blessed.box, {
      label: panelLabel.replace('%s', 'Equipment'),
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
      alwaysScroll: true,
    });

    this.actionsBox = this.grid.set(17, 0, 1, cols, blessed.box, {
      label: panelLabel.replace('%s', 'Quick Actions'),
      tags: true,
      border: panelBorder,
      style: { fg: Color.parchmentDim, border: { fg: Color.goldDeep } },
      align: 'center',
      content: ' ',
    });

    this.commandInput = this.grid.set(18, 0, 3, cols, blessed.textbox, {
      label: panelLabel.replace('%s', 'Command'),
      border: { type: BORDERS.round, style: { fg: Color.goldBright }, bold: true },
      style: {
        fg: Color.parchment,
        bg: Color.shadow,
        focus: {
          fg: Color.parchment,
          bg: Color.ink,
          border: { fg: Color.goldBright },
        },
      },
      inputOnFocus: true,
    });

    this.messageLog = this.grid.set(21, 0, 1, cols, blessed.log, {
      label: panelLabel.replace('%s', 'Chronicle'),
      tags: true,
      border: { type: BORDERS.round, style: { fg: Color.burgundy } },
      style: { fg: Color.parchment, border: { fg: Color.burgundy } },
      scrollback: 200,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
    });

    this._panels = {
      map: this.mapPanel,
      location: this.locationBox,
      status: this.statusBox,
      sparklines: this.sparkPanel,
      factions: this.factionsPanel,
      skills: this.skillsPanel,
      inventory: this.inventoryPanel,
      equipment: this.equipmentPanel,
      feed: this.messageLog,
      command: this.commandInput,
    };

    this._hintLine = `\n  {${Color.goldDeep}-fg}[M]ap  [C]har  [I]nv  [F]action  [?]help  [Tab] cycle focus  [Esc] quit{/}`;
    this.commandInput.setValue('');
  }

  _setupCompactUI() {
    const cols = 12, rows = 19;
    this.grid = new contrib.grid({ rows, cols, screen: this.screen });

    const panelBorder = { type: BORDERS.round, style: { fg: Color.gold }, bold: true };
    const baseStyle = { fg: Color.parchment, border: { fg: Color.gold } };

    this.headerBox = this.grid.set(0, 0, 1, cols, blessed.box, {
      tags: true,
      align: 'center',
      style: { fg: Color.goldBright, bg: Color.oxblood, bold: true },
    });

    this.mapPanel = this.grid.set(1, 0, 6, 7, blessed.box, {
      label: ` ${Glyph.fleur} Realm `,
      tags: true,
      border: panelBorder,
      style: baseStyle,
    });
    this.locationBox = this.grid.set(1, 7, 6, 5, blessed.box, {
      label: ` ${Glyph.fleur} Location `,
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
    });

    this.statusBox = this.grid.set(7, 0, 4, 8, blessed.box, {
      label: ' Status ',
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
    });
    this.factionsPanel = this.grid.set(7, 8, 4, 4, blessed.box, {
      label: ' Factions ',
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
    });

    this.inventoryPanel = this.grid.set(11, 0, 3, 6, blessed.box, {
      label: ' Inventory ',
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
    });
    this.skillsPanel = this.grid.set(11, 6, 3, 6, blessed.box, {
      label: ' Skills ',
      tags: true,
      border: panelBorder,
      style: baseStyle,
      scrollable: true,
    });

    this.sparkPanel = blessed.box({ parent: this.screen, hidden: true });
    this.equipmentPanel = blessed.box({ parent: this.screen, hidden: true });

    this.messageLog = this.grid.set(14, 0, 2, cols, blessed.log, {
      label: ' Chronicle ',
      tags: true,
      border: { type: BORDERS.round, style: { fg: Color.burgundy } },
      style: { fg: Color.parchment, border: { fg: Color.burgundy } },
      scrollback: 200,
      scrollable: true,
    });

    this.actionsBox = this.grid.set(16, 0, 1, cols, blessed.box, {
      label: ' Quick Actions ',
      tags: true,
      border: panelBorder,
      style: { fg: Color.parchmentDim, border: { fg: Color.goldDeep } },
      align: 'center',
    });

    this.commandInput = this.grid.set(17, 0, 2, cols, blessed.textbox, {
      label: ` ${Glyph.fleur}  Command `,
      border: { type: BORDERS.round, style: { fg: Color.goldBright }, bold: true },
      style: {
        fg: Color.parchment,
        bg: Color.shadow,
        focus: {
          fg: Color.parchment,
          bg: Color.ink,
          border: { fg: Color.goldBright },
        },
      },
      inputOnFocus: true,
    });

    this._panels = {
      map: this.mapPanel,
      location: this.locationBox,
      status: this.statusBox,
      sparklines: this.sparkPanel,
      factions: this.factionsPanel,
      skills: this.skillsPanel,
      inventory: this.inventoryPanel,
      equipment: this.equipmentPanel,
      feed: this.messageLog,
      command: this.commandInput,
    };

    this._hintLine = `\n  {${Color.goldDeep}-fg}[M]ap  [C]har  [I]nv  [?]help  [Tab] cycle  [Esc] quit{/}`;
  }

  setupKeybindings() {
    this.screen.key(['C-c'], () => process.exit(0));
    this.screen.key(['escape'], () => {
      if (this._helpOverlay && !this._helpOverlay.hidden) { this._toggleHelpOverlay(); return; }
      if (this._heirPicker && !this._heirPicker.hidden) { this._closeHeirPicker(); return; }
      if (this._creationWizard && !this._creationWizard.hidden) { this._closeCharacterCreation(); return; }
      return process.exit(0);
    });
    this.screen.key(['q'], () => process.exit(0));

    this.screen.key(['tab'], () => {
      if (this.screen.focused === this.commandInput) return;
      this._cycleFocus(1);
    });
    this.screen.key(['S-tab'], () => {
      if (this.screen.focused === this.commandInput) return;
      this._cycleFocus(-1);
    });

    this.screen.key(['?'], () => {
      if (this.screen.focused === this.commandInput) return;
      this._toggleHelpOverlay();
    });
    this.screen.key(['f1'], () => this._toggleHelpOverlay());

    this.commandInput.on('submit', (value) => {
      if (value && value.trim().length) {
        const trimmed = value.trim();
        this._commandHistory.push(trimmed);
        if (this._commandHistory.length > 50) this._commandHistory.shift();
        this._commandHistoryIdx = this._commandHistory.length;
        this.handleCommand(trimmed);
      }
      this.commandInput.clearValue();
      this._commandHistoryIdx = this._commandHistory.length;
      this.screen.render();
    });

    this.commandInput.on('keypress', (ch, key) => {
      if (!key) return;
      if (key.name === 'up') return this._historyPrev();
      if (key.name === 'down') return this._historyNext();
      if (key.name === 'tab') return this._autocomplete();
    });

    const shortcut = (key, value) => {
      this.screen.key([key], () => {
        if (this.screen.focused === this.commandInput) return;
        this._runQuickAction(value);
      });
    };
    // Movement
    shortcut('w', 'work');
    shortcut('s', 'sleep');
    shortcut('e', 'eat');
    shortcut('l', 'look');
    shortcut('m', 'move');
    // Inspection
    shortcut('i', 'inventory');
    shortcut('c', 'status');
    shortcut('f', 'faction');
    shortcut('h', 'help');
    shortcut('?', 'help');
    // Common actions
    shortcut('d', 'drink');
    shortcut('t', 'take');
    shortcut('x', 'drop');
    shortcut('r', 'recipes');
    shortcut('g', 'gather');
    shortcut('p', 'prayer');
    shortcut('b', 'buy');
    shortcut('v', 'sell');
    shortcut('n', 'family');

    this.screen.key(['enter'], () => {
      if (this.screen.focused !== this.commandInput) this.commandInput.focus();
    });
  }

  _runQuickAction(cmd) {
    if (this._welcomeActive) {
      if (cmd === 'help') return this._toggleHelpOverlay();
      if (cmd === 'start' || cmd === 'look' || cmd === 'quit') return this.handleCommand(cmd);
      return;
    }
    return this.handleCommand(cmd);
  }

  start() {
    this._commandList = this._buildCommandList();
    this._commandHistory = [];
    this._commandHistoryIdx = 0;
    this.showWelcome();
    if (this.screen.focused !== this.commandInput) this.commandInput.focus();
    this.screen.render();

    if (this._tickTimer) clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => this._liveTick(), 1000);
  }

  destroy() {
    if (this._tickTimer) {
      clearInterval(this._tickTimer);
      this._tickTimer = null;
    }
    if (this._unregisterUI && typeof this.game.unregisterUIListener === 'function') {
      this._unregisterUI();
    }
    if (this.screen) {
      try { this.screen.destroy(); } catch (_) { /* noop */ }
    }
  }

  showWelcome() {
    this._welcomeActive = true;
    const art = this.compactMode ? WELCOME_ART_COMPACT : WELCOME_ART;
    const lore = WELCOME_LORE;

    let msg = '';
    art.forEach((line) => {
      msg += `{center}{${Color.gold}-fg}${line}{/${Color.gold}-fg}{/center}\n`;
    });
    msg += '\n';
    lore.forEach((line) => {
      msg += `{center}{${Color.parchmentDim}-fg}${line}{/${Color.parchmentDim}-fg}{/center}\n`;
    });
    msg += '\n';
    msg += `{center}{${Color.goldBright}-fg}${Glyph.star}  Type {${Color.parchment}-fg}start{/} to begin a new life, {${Color.parchment}-fg}help{/} for commands, or {${Color.parchment}-fg}quit{/} to leave.  {/${Color.goldBright}-fg}{/center}\n`;

    if (!this.mapPanel) return;
    this.mapPanel.setContent(msg);
    this.locationBox.setContent(this._welcomeLocation());
    this.statusBox.setContent(this._welcomeStatus());
    this.sparkPanel.setContent(this._welcomeSpark());
    this.factionsPanel.setContent(this._welcomeFactions());
    this.skillsPanel.setContent(this._welcomeSkills());
    this.inventoryPanel.setContent(this._welcomeInventory());
    this.equipmentPanel.setContent(this._welcomeEquipment());
    this.headerBox.setContent(this._buildHeader());

    this.log('Welcome to Medieval Life. Type `start` to begin, `?` for help.', 'system');
    this.screen.render();
  }

  _welcomeLocation() {
    return `\n  {${Color.parchmentDim}-fg}Awaiting birth.\n  Type {${Color.goldBright}-fg}start{/${Color.goldBright}-fg} to choose a name and begin your chronicle.{/${Color.parchmentDim}-fg}`;
  }
  _welcomeStatus() { return this._idlePanel('Status awaits a soul.'); }
  _welcomeSpark() { return this._idlePanel('Vitals will track once a soul is born.'); }
  _welcomeFactions() { return this._idlePanel(`${Glyph.fleur}  No factions yet.`); }
  _welcomeSkills() { return this._idlePanel('No skills to show.'); }
  _welcomeInventory() { return this._idlePanel('Inventory awaits.'); }
  _welcomeEquipment() { return this._idlePanel('Equipment awaits.'); }

  _idlePanel(text) {
    return `\n  {${Color.parchmentDim}-fg}${text}{/${Color.parchmentDim}-fg}\n`;
  }

updateDisplay() {
    const player = this.query.getPlayer();
    if (!player) {
      this.showWelcome();
      return;
    }
    this._welcomeActive = false;
    this.headerBox.setContent(this._buildHeader());

    if (this.mapPanel) this._renderMap();
    if (this.locationBox) this.updateLocation();
    if (this.statusBox) this.updateStatus();
    if (this.sparkPanel && !this.compactMode) this._renderSparklines();
    if (this.factionsPanel) this._renderFactions();
    if (this.skillsPanel) this._renderSkills();
    if (this.inventoryPanel) this._renderInventory();
    if (this.equipmentPanel) this._renderEquipment();
    if (this.actionsBox) this.updateActions();

    if (player.alive === false && !this._heirPickerHandled) {
      this._showHeirPicker(player);
    }

    this.screen.render();
  }

  _liveTick() {
    if (!this.screen || this.screen.destroyed) return;
    const player = this.query.getPlayer();
    if (!player) return;
    this._pushSparkSample();
    try {
      this.updateDisplay();
    } catch (err) {
      this.log(`Display error: ${err.message}`, 'error');
    }
  }

  _pushSparkSample() {
    const summary = this.query.getPlayerSummary();
    if (!summary || summary.alive === false) return;
    const needs = summary.needs || {};
    const sample = (key, v) => {
      const arr = this._sparkSamples[key] || (this._sparkSamples[key] = []);
      arr.push(Math.max(0, Math.min(1, v || 0)));
      if (arr.length > this._sparkMax) arr.shift();
    };
    sample('hunger', 1 - (needs.hunger || 0));
    sample('thirst', 1 - (needs.thirst || 0));
    sample('sleep',  1 - (needs.sleep  || 0));
    sample('energy', needs.energy !== undefined ? needs.energy : (1 - (needs.hunger || 0) * 0.5));
    sample('health', summary.health ? summary.health.overall : 1);
  }

  _buildHeader() {
    const player = this.game.getPlayer();
    if (!player) {
      return `{${Color.goldBright}-fg}${Glyph.fleur}  MEDIEVAL LIFE — A Chronicle  {${Color.gold}-fg}${Glyph.fleur}{/}`;
    }
    const w = this.game.getWorldInfo ? this.game.getWorldInfo() : {};
    const season = w.season || 'Spring';
    const tod = w.timeOfDay || 'Day';
    const turn = this.game.kernel ? this.game.kernel.turn : 0;
    const t = formatGameTime(turn);
    return (
      ` {${Color.goldBright}-fg}${Glyph.fleur}  ${player.name}{/${Color.goldBright}-fg}` +
      ` {${Color.parchmentDim}-fg}| Age {${Color.gold}-fg}${Math.floor(player.age || 0)}{/} ` +
      `| {${Color.midnightBright}-fg}${player.occupation || 'commoner'}{/} ` +
      `| {${Color.forestBright}-fg}${Glyph.leaf} ${season}{/} ` +
      `| {${Color.amber}-fg}${Glyph.sun} ${tod}{/} ` +
      `| Day {${Color.gold}-fg}${t.day}{/} {${Color.parchmentDim}-fg}${t.hh}:${t.mm}{/} {/${Color.parchmentDim}-fg}` +
      ` {${Color.gold}-fg}${Glyph.fleur}{/}`
    );
  }

  _renderHints() {
    if (!this.actionsBox) return;
    const hints = [
      `{${Color.goldBright}-fg}[W]{/${Color.goldBright}-fg}{${Color.parchment}-fg}ork{/}`,
      `{${Color.sapphire}-fg}[S]{/${Color.sapphire}-fg}{${Color.parchment}-fg}leep{/}`,
      `{${Color.amber}-fg}[E]{/${Color.amber}-fg}{${Color.parchment}-fg}at{/}`,
      `{${Color.forestBright}-fg}[L]{/${Color.forestBright}-fg}{${Color.parchment}-fg}ook{/}`,
      `{${Color.burgundyBright}-fg}[M]{/${Color.burgundyBright}-fg}{${Color.parchment}-fg}ove{/}`,
      `{${Color.goldDeep}-fg}[I]{/${Color.goldDeep}-fg}nv`,
      `{${Color.goldDeep}-fg}[C]{/${Color.goldDeep}-fg}har`,
      `{${Color.goldDeep}-fg}[?]{/${Color.goldDeep}-fg}{${Color.parchment}-fg}help{/}`,
      `{${Color.goldDeep}-fg}[Tab]{/${Color.goldDeep}-fg}{${Color.parchment}-fg}focus{/}`,
      `{${Color.goldDeep}-fg}[Esc]{/${Color.goldDeep}-fg}{${Color.parchment}-fg}quit{/}`,
    ];
    this.actionsBox.setContent(hints.join('   '));
  }

  updateLocation() {
    const player = this.game.getPlayer();
    if (!player) return;

    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const nearby = this.game.kernel.queryEntitiesNear(
      player.position.x, player.position.y, player.position.z || 0, 10
    );

    const lines = [];
    lines.push(`{${Color.goldBright}-fg}${Glyph.fleur}  ${tile.biome ? this.capitalize(tile.biome.type) : 'Unknown'}{/}`);
    lines.push('');
    lines.push(`  {${Color.parchmentDim}-fg}Biome: {/${Color.parchmentDim}-fg}{${Color.gold}-fg}${tile.biome ? this.capitalize(tile.biome.type) : '?'}{/}`);
    lines.push(`  {${Color.parchmentDim}-fg}Elevation: {/${Color.parchmentDim}-fg}{${Color.gold}-fg}${Math.floor(tile.terrain.elevation)}m{/}`);
    lines.push(`  {${Color.parchmentDim}-fg}Temperature: {/${Color.parchmentDim}-fg}{${Color.gold}-fg}${Math.floor(tile.climate.temperature)}°C{/}`);
    lines.push(`  {${Color.parchmentDim}-fg}Weather: {/${Color.parchmentDim}-fg}{${Color.gold}-fg}${tile.climate.rainfall > 5 ? `Rainy ${Glyph.water}` : `Clear ${Glyph.sun}`}{/}`);
    lines.push('');

    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length > 0) {
      lines.push(`{${Color.goldBright}-fg}${Glyph.bag}  Items on ground{/}`);
      for (const item of groundItems.slice(0, 5)) {
        const label = item.subtype ? `${item.type} (${item.subtype})` : `${item.type}`;
        lines.push(`  {${Color.parchment}-fg}• {${Color.goldDeep}-fg}${label}{/}`);
      }
      if (groundItems.length > 5) {
        lines.push(`  {${Color.mute}-fg}… and ${groundItems.length - 5} more{/}`);
      }
      lines.push('');
    }

    const others = nearby.filter(id => id !== player.id).slice(0, 8);
    if (others.length > 0) {
      lines.push(`{${Color.goldBright}-fg}${Glyph.crownLight}  Nearby People{/}`);
      let n = 0;
      for (const id of others) {
        const entity = this.game.kernel.entities.get(id);
        if (!entity || !entity.name) continue;
        const occColor = entity.occupation === 'merchant' ? Color.gold : entity.occupation === 'noble' ? Color.burgundyBright : Color.parchment;
        lines.push(`  {${Color.mute}-fg}• {/${Color.mute}-fg}{${occColor}-fg}${entity.name}{/} {${Color.mute}-fg}(${entity.occupation || 'commoner'}){/}`);
        n += 1;
      }
      if (nearby.length - 1 > n) lines.push(`  {${Color.mute}-fg}… and ${nearby.length - 1 - n} others{/}`);
      lines.push('');
    }

    if (tile.resources && tile.resources.length > 0) {
      lines.push(`{${Color.goldBright}-fg}${Glyph.star}  Resources{/}`);
      for (const res of tile.resources.slice(0, 5)) {
        const remaining = (res.amount || 0) - (res.extracted || 0);
        const c = remaining > 50 ? Color.forestBright : remaining > 20 ? Color.amber : Color.crimson;
        lines.push(`  {${Color.mute}-fg}• {/${Color.mute}-fg}{${c}-fg}${this.capitalize(res.type)}{/} {${Color.mute}-fg}(${remaining}){/}`);
      }
    }

    this.locationBox.setContent(lines.join('\n'));
  }

  updateStatus() {
    const player = this.game.getPlayer();
    if (!player) return;

    const status = player.getStatus ? player.getStatus() : { needs: {} };
    const health = (player.physiology && player.physiology.getHealthStatus)
      ? player.physiology.getHealthStatus()
      : { overall: 1, pain: 0, fatigue: 0 };

    const lines = [];
    const sex = player.sex ? player.sex : '';
    lines.push(`{${Color.goldBright}-fg}${player.name}{/} {${Color.parchmentDim}-fg}· ${sex ? sex + ' · ' : ''}age ${Math.floor(player.age || 0)} · ${player.occupation || 'commoner'}{/}`);
    lines.push('');

    lines.push(this._barLine('Health',  health.overall || 0, 15, { suffix: `${Math.round((health.overall || 0) * 100)}%` }));
    lines.push(this._barLine('Pain',    Math.max(0, 1 - (health.pain || 0) / 10), 15, { suffix: `${(health.pain || 0).toFixed(1)}/10`, inverse: true }));
    lines.push(this._barLine('Fatigue', Math.max(0, 1 - (health.fatigue || 0)), 15, { suffix: `${Math.round((health.fatigue || 0) * 100)}%`, inverse: true }));
    lines.push('');

    const needs = status.needs || {};
    lines.push(`{${Color.goldDeep}-fg}${Glyph.fleur}  Needs{/}`);
    lines.push(this._barLine('Hunger', 1 - (needs.hunger || 0), 12, { inverse: true }));
    lines.push(this._barLine('Thirst', 1 - (needs.thirst || 0), 12, { inverse: true }));
    lines.push(this._barLine('Sleep',  1 - (needs.sleep  || 0), 12, { inverse: true }));
    if (needs.energy !== undefined) lines.push(this._barLine('Energy', needs.energy || 0, 12));
    lines.push('');

    const household = this.game.kernel.entities.get(player.household);
    if (household) {
      lines.push(`{${Color.goldDeep}-fg}${Glyph.castle}  Household{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}Members: {/${Color.parchmentDim}-fg}{${Color.parchment}-fg}${household.members.length}{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}Food:    {/${Color.parchmentDim}-fg}{${Color.forestBright}-fg}${Math.round(household.food || 0)}{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}Wealth:  {/${Color.parchmentDim}-fg}{${Color.goldBright}-fg}${Math.round(household.wealth || 0)}{/}`);
    }

    const ws = this.game.getPlayerWealthSummary ? this.game.getPlayerWealthSummary() : null;
    if (ws) {
      lines.push('');
      lines.push(`{${Color.goldDeep}-fg}${Glyph.coin}  Purse{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}${ws.purse.gold || 0}g ${ws.purse.silver || 0}s ${ws.purse.copper || 0}c{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}Liquid: {/${Color.parchmentDim}-fg}{${Color.goldBright}-fg}≈${ws.liquidCopper || 0}c{/}`);
      lines.push(`  {${Color.parchmentDim}-fg}Rate:   {/${Color.parchmentDim}-fg}{${Color.sapphire}-fg}${ws.regionalCurrency ? ws.regionalCurrency.toFixed(2) : '1.00'}×{/}`);
    }

    this.statusBox.setContent(lines.join('\n'));
  }

  _barLine(label, value, len, { suffix = '', inverse = false } = {}) {
    const tag = (v) => v > 0.6 ? Color.forestBright : v > 0.3 ? Color.amber : Color.crimson;
    const v = inverse ? 1 - value : value;
    const c = tag(v);
    return `  {${Color.parchmentDim}-fg}${label.padEnd(8)}{/${Color.parchmentDim}-fg}{${c}-fg}${themeBar(value, len)}{/${c}-fg} {${Color.mute}-fg}${suffix}{/}`;
  }

  updateActions() {
    this._renderHints();
  }

  getBar(value, length) {
    return themeBar(value, length);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Map (worldMapPanel) ─ 14×10 biome glyph view centered on player.
  // ─────────────────────────────────────────────────────────────────────────
  _viewBounds() {
    const player = this.game.getPlayer();
    const width = this.mapPanel.width - 2;
    const height = this.mapPanel.height - 2;
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const cx = player ? player.position.x : 0;
    const cy = player ? player.position.y : 0;
    const w = this.game.world ? this.game.world.width : 0;
    const h = this.game.world ? this.game.world.height : 0;
    return {
      x0: Math.max(0, cx - halfW),
      y0: Math.max(0, cy - halfH),
      x1: Math.min(w - 1, cx + halfW),
      y1: Math.min(h - 1, cy + halfH),
      width, height, cx, cy,
    };
  }

  _renderMap() {
    if (!this.mapPanel) return;
    const player = this.game.getPlayer();
    if (!player) return this.mapPanel.setContent('');

    const b = this._viewBounds();
    const turn = this.game.kernel ? this.game.kernel.turn : 0;
    if (this._mapCache.turn === turn && this._mapCache.content && b.cx === this._mapCache.cx && b.cy === this._mapCache.cy) {
      this.mapPanel.setContent(this._mapCache.content);
      return;
    }

    const cols = b.x1 - b.x0 + 1;
    const rows = b.y1 - b.y0 + 1;
    const out = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const wx = b.x0 + x;
        const wy = b.y0 + y;
        if (wx === b.cx && wy === b.cy) {
          row.push(`{${Color.goldBright}-fg}${Glyph.at}{/}`);
          continue;
        }
        const tile = this._safeTile(wx, wy);
        const biome = tile && tile.biome ? tile.biome.type : 'unknown';
        const cfg = BIOME[biome] || BIOME.unknown;
        const settlement = tile && tile.settlementId != null;
        if (settlement) {
          row.push(`{${Color.goldBright}-fg}${BIOME.settlement.glyph}{/}`);
        } else {
          row.push(`{${cfg.fg}-fg}${cfg.glyph}{/}`);
        }
      }
      out.push(row.join(''));
    }
    const content = out.join('\n');
    this._mapCache = { turn, content, cx: b.cx, cy: b.cy };
    this.mapPanel.setContent(content);
  }

  _safeTile(x, y) {
    try { return this.game.world.getTile(x, y); }
    catch (_) { return null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sparklines ─ small ASCII line of last N samples for each vital.
  // ─────────────────────────────────────────────────────────────────────────
  _renderSparklines() {
    if (!this.sparkPanel) return;
    const keys = [
      { k: 'health', label: 'Health' },
      { k: 'hunger', label: 'Feed',  inverse: true },
      { k: 'thirst', label: 'Drink', inverse: true },
      { k: 'sleep',  label: 'Rest',  inverse: true },
      { k: 'energy', label: 'Energy' },
    ];
    const width = Math.max(8, (this.sparkPanel.width || 24) - 12);
    const lines = [];
    for (const { k, label, inverse } of keys) {
      const samples = this._sparkSamples[k] || [];
      const last = samples.length ? samples[samples.length - 1] : 0;
      const glyphs = '▁▂▃▄▅▆▇█';
      const spark = samples.slice(-width).map((v) => {
        const idx = Math.max(0, Math.min(glyphs.length - 1, Math.floor(v * glyphs.length)));
        return glyphs[idx];
      }).join('');
      const padded = spark.padEnd(width, ' ');
      const v = inverse ? 1 - last : last;
      const c = v > 0.6 ? Color.forestBright : v > 0.3 ? Color.amber : Color.crimson;
      lines.push(`{${Color.parchmentDim}-fg}${label.padEnd(6)}{/${Color.parchmentDim}-fg}{${c}-fg}${padded}{/${c}-fg} {${Color.mute}-fg}${Math.round(last * 100)}%{/}`);
    }
    this.sparkPanel.setContent(lines.join('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factions ─ top 5 by member count.
  // ─────────────────────────────────────────────────────────────────────────
  _renderFactions() {
    if (!this.factionsPanel) return;
    const sorted = this.query.getTopFactions(5);
    if (!sorted.length) {
      this.factionsPanel.setContent(`\n  {${Color.mute}-fg}${Glyph.fleur}  No factions yet.{/${Color.mute}-fg}\n`);
      return;
    }
    const lines = [];
    for (const f of sorted) {
      lines.push(`  {${Color.gold}-fg}${Glyph.fleur}{/${Color.gold}-fg} {${Color.parchment}-fg}${f.name}{/} {${Color.mute}-fg}(${f.count}){/}`);
      if (f.purpose) lines.push(`      {${Color.parchmentDim}-fg}${f.purpose.slice(0, 22)}{/${Color.parchmentDim}-fg}`);
    }
    this.factionsPanel.setContent(lines.join('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Skills ─ grouped, top 12 by level.
  // ─────────────────────────────────────────────────────────────────────────
  _renderSkills() {
    if (!this.skillsPanel) return;
    const player = this.game.getPlayer();
    if (!player) return;
    const skills = player.skills || {};
    const flat = [];
    for (const cat of Object.keys(skills)) {
      const sub = skills[cat];
      if (!sub || typeof sub !== 'object') continue;
      for (const name of Object.keys(sub)) {
        const lvl = sub[name];
        if (typeof lvl === 'number') flat.push({ cat, name, lvl });
      }
    }
    flat.sort((a, b) => b.lvl - a.lvl);
    const lines = [];
    let lastCat = null;
    for (const s of flat.slice(0, 12)) {
      if (s.cat !== lastCat) {
        lines.push(`{${Color.goldDeep}-fg}${s.cat.toUpperCase()}{/${Color.goldDeep}-fg}`);
        lastCat = s.cat;
      }
      const bar = themeBar(s.lvl, 8);
      const c = s.lvl > 0.6 ? Color.forestBright : s.lvl > 0.3 ? Color.gold : Color.parchmentDim;
      lines.push(`  {${Color.parchmentDim}-fg}${s.name.padEnd(10)}{/${Color.parchmentDim}-fg}{${c}-fg}${bar}{/${c}-fg} {${Color.mute}-fg}${s.lvl.toFixed(2)}{/}`);
    }
    if (!lines.length) lines.push(`{${Color.mute}-fg}  No skills yet.{/${Color.mute}-fg}`);
    this.skillsPanel.setContent(lines.join('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Inventory ─ 2-column: name | weight | qty, colored by category.
  // ─────────────────────────────────────────────────────────────────────────
  _renderInventory() {
    if (!this.inventoryPanel) return;
    const player = this.game.getPlayer();
    if (!player || !player.inventory) {
      this.inventoryPanel.setContent(`\n  {${Color.mute}-fg}(empty){/${Color.mute}-fg}\n`);
      return;
    }
    const items = player.inventory.items || [];
    const cap = player.inventory.capacity || 50;
    const weight = player.inventory.weight || 0;
    const lines = [];
    lines.push(`{${Color.parchmentDim}-fg}Weight {${Color.gold}-fg}${Math.round(weight)}{/${Color.gold}-fg}/${cap}kg · {${Color.gold}-fg}${items.length}{/${Color.gold}-fg} items{/}`);
    lines.push('');
    for (const item of items.slice(0, 16)) {
      const cat = (item.category || item.type || 'misc').toLowerCase();
      const c = ITEM_CATEGORY[cat] || Color.parchment;
      const qty = item.quantity && item.quantity > 1 ? `×${item.quantity}` : '';
      lines.push(`  {${c}-fg}• {/${c}-fg}{${Color.parchment}-fg}${item.name || item.type || '?'}{/} {${Color.mute}-fg}${item.mass || 0}kg ${qty}{/}`);
    }
    if (!items.length) lines.push(`  {${Color.mute}-fg}(empty){/${Color.mute}-fg}`);
    this.inventoryPanel.setContent(lines.join('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Equipment ─ slot-based layout.
  // ─────────────────────────────────────────────────────────────────────────
  _renderEquipment() {
    if (!this.equipmentPanel) return;
    const player = this.game.getPlayer();
    if (!player) return;
    const eq = player.equipment || {};
    const slots = ['weapon', 'armor', 'helmet', 'boots', 'cloak', 'gloves', 'ring', 'amulet'];
    const lines = [];
    for (const slot of slots) {
      const glyph = SLOT_GLYPH[slot] || Glyph.diamond;
      const item = eq[slot];
      const label = item ? (item.name || item.type || '—') : '—';
      const c = item ? Color.parchment : Color.mute;
      lines.push(`  {${Color.gold}-fg}${glyph}{/${Color.gold}-fg} {${Color.parchmentDim}-fg}${slot.padEnd(8)}{/${Color.parchmentDim}-fg} {${c}-fg}${label}{/}`);
    }
    this.equipmentPanel.setContent(lines.join('\n'));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Focus cycling (Tab / Shift-Tab).
  // ─────────────────────────────────────────────────────────────────────────
  _cycleFocus(dir) {
    if (!this._panels) return;
    this._focusIdx = (this._focusIdx + dir + FOCUSABLE_PANELS.length) % FOCUSABLE_PANELS.length;
    this._refreshFocus();
  }

  _refreshFocus() {
    if (!this._panels) return;
    for (const k of FOCUSABLE_PANELS) {
      const p = this._panels[k];
      if (!p || typeof p.setFront !== 'function') continue;
      if (p.style && p.style.border) p.style.border.fg = Color.goldDeep;
    }
    const cur = FOCUSABLE_PANELS[this._focusIdx];
    const panel = this._panels[cur];
    if (panel && panel.style && panel.style.border) {
      panel.style.border.fg = Color.goldBright;
    }
    if (cur === 'command' && this.commandInput) {
      if (this.screen.focused !== this.commandInput) this.commandInput.focus();
    }
    this.screen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Command history + autocomplete.
  // ─────────────────────────────────────────────────────────────────────────
  _historyPrev() {
    if (!this._commandHistory.length) return;
    if (this._commandHistoryIdx > 0) this._commandHistoryIdx -= 1;
    const v = this._commandHistory[this._commandHistoryIdx] || '';
    this.commandInput.setValue(v);
    this.screen.render();
  }
  _historyNext() {
    if (!this._commandHistory.length) return;
    if (this._commandHistoryIdx < this._commandHistory.length - 1) {
      this._commandHistoryIdx += 1;
      this.commandInput.setValue(this._commandHistory[this._commandHistoryIdx] || '');
    } else {
      this._commandHistoryIdx = this._commandHistory.length;
      this.commandInput.setValue('');
    }
    this.screen.render();
  }

  _autocomplete() {
    const cur = this.commandInput.getValue() || '';
    if (!this._commandList || !this._commandList.length) {
      this._commandList = this._buildCommandList();
    }
    const candidates = this._commandList.filter((c) => c.startsWith(cur));
    if (candidates.length === 1) {
      this.commandInput.setValue(candidates[0]);
    } else if (candidates.length > 1) {
      let prefix = candidates[0];
      for (const c of candidates.slice(1)) {
        while (!c.startsWith(prefix) && prefix.length) prefix = prefix.slice(0, -1);
      }
      if (prefix && prefix.length > cur.length) this.commandInput.setValue(prefix);
      this.log(`${candidates.length} matches: ${candidates.slice(0, 8).join(', ')}${candidates.length > 8 ? '…' : ''}`, 'info');
    }
    this.screen.render();
  }

  _buildCommandList() {
    return [
      'start','look','status','inventory','family','heirs','dev',
      'help','move','take','drop','eat','drink','sleep','work','wait',
      'talk','propose','marry','family','adopt','orphans','faction','form-faction',
      'warfare','claim-land','buy-land','land','muster','barter','study','apprentice',
      'discover','observe','recipes','cook','cure','shop','browse','buy','sell','haggle',
      'loans','repay','craft','gather','harvest','hunt','forage','plant','gossip',
      'attack','save','load','quit','exit',
      'declare-battle','battle','battle-round','march','retreat','assault','siege',
      'betray','scheme','spy','coup','intrigues','steal','accuse','laws','cases','enact-law',
      'prayer','offering','ritual','prophecy','temples','clergy','ordain','bless','exorcise','pilgrimage','sacrifice',
      'mount','dismount','sail','drive','vehicles','stables','travel','fast-travel',
      'elect','coronate','abdicate','regent','dynasty','propose-law','sign-treaty','ratify','vassal','hold-council',
      'titles','claim-title','grant-title','house','levy','court',
      'spells','learn','cast','mana','continue',
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Help overlay (?).
  // ─────────────────────────────────────────────────────────────────────────
  _toggleHelpOverlay() {
    if (this._helpOverlay && !this._helpOverlay.hidden) {
      this._helpOverlay.destroy();
      this._helpOverlay = null;
      this._showAllPanels(true);
      this.screen.render();
      return;
    }
    this._showAllPanels(false);
    this._helpOverlay = blessed.box({
      parent: this.screen,
      label: ` ${Glyph.fleur}  Help  ${Glyph.fleur} `,
      tags: true,
      top: 'center',
      left: 'center',
      width: '70%',
      height: '70%',
      border: { type: 'double', style: { fg: Color.goldBright } },
      style: { fg: Color.parchment, bg: Color.shadow, border: { fg: Color.goldBright } },
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      mouse: true,
      content: this._buildHelpContent(),
    });
    this._helpOverlay.focus();
    this.screen.render();
  }

  _showAllPanels(visible) {
    for (const k of Object.keys(this._panels || {})) {
      const p = this._panels[k];
      if (!p || typeof p.show !== 'function') continue;
      if (visible) p.show(); else p.hide();
    }
    if (visible && this.commandInput) this.commandInput.show();
    if (visible) {
      this._focusIdx = FOCUSABLE_PANELS.indexOf('command');
      this._refreshFocus();
    }
  }

  _buildHelpContent() {
    const section = (title, items) => {
      let s = `\n  {${Color.goldBright}-fg}${Glyph.fleur} ${title}{/${Color.goldBright}-fg}\n`;
      for (const it of items) {
        s += `  {${Color.gold}-fg}${it[0].padEnd(14)}{/${Color.gold}-fg} {${Color.parchment}-fg}${it[1]}{/}\n`;
      }
      return s;
    };
    return (
      `\n  {${Color.goldBright}-fg}Commands reference. Press ? or Esc to close.{/${Color.goldBright}-fg}\n` +
      section('Character', [
        ['start', 'begin a new life'],
        ['status / c', 'detailed character status'],
        ['inventory / i', 'list items'],
        ['family', 'show family tree'],
        ['heirs', 'list eligible heirs'],
        ['dev', 'toggle dev mode'],
      ]) +
      section('Movement & Actions', [
        ['look / l', 'examine surroundings'],
        ['move n/s/e/w', 'travel one tile'],
        ['take', 'pick up item'],
        ['drop', 'put down item'],
        ['eat / e', 'consume food'],
        ['drink', 'drink water'],
        ['sleep / s', 'rest until rested'],
        ['work / w', 'work at occupation'],
        ['wait / rest', 'pass time'],
        ['gather/harvest/hunt/forage', 'natural-world actions'],
      ]) +
      section('Social', [
        ['talk', 'speak to a nearby NPC'],
        ['propose', 'propose marriage'],
        ['marry', 'accept proposal'],
        ['adopt / orphans', 'adopt a child'],
        ['gossip', 'spread rumor'],
      ]) +
      section('Politics & Warfare', [
        ['faction', 'list factions'],
        ['form-faction', 'found a faction'],
        ['claim-land / buy-land', 'acquire territory'],
        ['muster', 'raise army'],
        ['declare-battle', 'start a war'],
        ['battle / battle-round', 'fight'],
        ['siege / assault / march / retreat', 'campaign'],
      ]) +
      section('Economy', [
        ['shop / browse / buy / sell / haggle', 'commerce'],
        ['loans / repay', 'credit'],
        ['craft / cook / recipes', 'production'],
      ] +
      '') +
      section('Knowledge', [
        ['study / apprentice', 'learn a skill'],
        ['discover / observe', 'research'],
        ['spells / learn / cast / mana', 'arcana'],
      ]) +
      section('Religion', [
        ['prayer / offering / ritual / prophecy', 'worship'],
        ['temples / clergy / ordain / bless', 'clergy actions'],
      ]) +
      section('Keys', [
        ['?', 'show this help'],
        ['Tab', 'cycle focused panel'],
        ['Shift+Tab', 'cycle reverse'],
        ['↑ / ↓', 'recall command history'],
        ['Tab (in input)', 'autocomplete'],
        ['Esc', 'dismiss overlay / quit'],
      ])
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Heir picker (on death).
  // ─────────────────────────────────────────────────────────────────────────
  _showHeirPicker(deadPlayer) {
    if (!deadPlayer) return;
    this._heirPickerHandled = true;
    if (!this.game.kinship || !this.game.kinship.getEligibleHeirs) {
      this.log('No kinship system available.', 'error');
      return;
    }
    const heirs = (this.game.kinship.getEligibleHeirs(deadPlayer.id) || []).filter((id) => {
      const e = this.game.kernel.entities.get(id);
      return e && e.alive !== false;
    });
    if (!heirs.length) {
      this.log('No eligible heirs. The line ends.', 'system');
      return;
    }
    this._showAllPanels(false);
    this._heirPicker = blessed.list({
      parent: this.screen,
      label: ` ${Glyph.skull}  Choose an Heir  ${Glyph.skull} `,
      tags: true,
      top: 'center',
      left: 'center',
      width: '60%',
      height: '60%',
      border: { type: 'double', style: { fg: Color.burgundyBright } },
      style: { fg: Color.parchment, bg: Color.shadow, border: { fg: Color.burgundyBright }, selected: { bg: Color.burgundy } },
      keys: true,
      mouse: true,
      items: heirs.map((id, idx) => {
        const e = this.game.kernel.entities.get(id);
        const name = e && e.name ? e.name : `heir-${idx}`;
        const age = e && e.age ? Math.floor(e.age) : '?';
        const occ = e && e.occupation ? e.occupation : 'commoner';
        return `{${Color.gold}-fg}[${idx + 1}]{/${Color.gold}-fg} {${Color.parchment}-fg}${name}{/} {${Color.mute}-fg}· age ${age} · ${occ}{/}`;
      }),
    });
    this._heirPicker.on('select', (_item, idx) => {
      try {
        const result = this.game.continueAsHeir(heirs[idx]);
        if (result && result.success) {
          this.log(`You are now ${result.name || 'an heir'}.`, 'system');
        }
      } catch (err) {
        this.log(`Heir selection failed: ${err.message}`, 'error');
      }
      this._closeHeirPicker();
      this.updateDisplay();
    });
    this._heirPicker.focus();
    this.screen.render();
  }

  _closeHeirPicker() {
    if (this._heirPicker) {
      this._heirPicker.destroy();
      this._heirPicker = null;
    }
    this._heirPickerHandled = false;
    this._showAllPanels(true);
    this.screen.render();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Character creation wizard — invoked by `start` when no player exists.
  // Replaces the previous stub which rendered a blessed.box with a "press
  // Enter" prompt but had no textbox child, so typing went into the void.
  // ─────────────────────────────────────────────────────────────────────────
  _openCharacterCreation() {
    if (this._creationWizard) return;
    this._showAllPanels(false);

    const screen = this.screen;
    const self = this;
    this._creationWizard = {
      step: 'name',
      name: '',
      sex: 'male',
    };

    this._creationWizard.frame = blessed.box({
      parent: screen,
      label: ` ${Glyph.fleur}  Character Creation  ${Glyph.fleur} `,
      tags: true,
      top: 'center',
      left: 'center',
      width: '60%',
      height: 11,
      border: { type: 'double', style: { fg: Color.goldBright } },
      style: { fg: Color.parchment, bg: Color.shadow, border: { fg: Color.goldBright } },
      content: '',
    });

    this._creationWizard.title = blessed.box({
      parent: this._creationWizard.frame,
      top: 0, left: 0, right: 0, height: 1,
      tags: true,
      align: 'center',
      style: { fg: Color.goldBright, bold: true },
      content: 'Choose the name of your character.',
    });

    this._creationWizard.hint = blessed.box({
      parent: this._creationWizard.frame,
      top: 1, left: 0, right: 0, height: 1,
      tags: true,
      align: 'center',
      style: { fg: Color.parchmentDim },
      content: 'Enter a name, or leave blank for a random one.',
    });

    this._renderWizardBody();
    this._creationWizard.prompt.focus();
    screen.render();
  }

  _renderWizardBody() {
    const wiz = this._creationWizard;
    if (!wiz) return;
    if (wiz.step === 'name') {
      wiz.title.setContent('Choose the name of your character.');
      wiz.hint.setContent('Enter a name, or leave blank for a random one.');
      wiz.prompt = blessed.textbox({
        parent: wiz.frame,
        top: 3, left: 2, right: 2, height: 1,
        border: { type: 'line', style: { fg: Color.gold } },
        inputOnFocus: true,
        keys: true,
        style: { fg: Color.parchment, bg: Color.shadow, focus: { border: { fg: Color.goldBright } } },
      });
      const self = this;
      wiz.prompt.on('submit', (value) => {
        const entered = (value || '').trim();
        wiz.name = entered || self._randomName(wiz.sex);
        wiz.step = 'sex';
        wiz.title.setContent(`Your name: {${Color.goldBright}-fg}${wiz.name}{/}`);
        wiz.hint.setContent('Sex? type {${Color.goldBright}-fg}male{/} or {${Color.goldBright}-fg}female{/} (or m / f), then Enter.');
        // Recreate the prompt in place — destroy+recreate ensures a single
        // submit handler is bound at any time. (Round-2 regression: a stacked
        // outer handler fired alongside this one and skipped the sex prompt.)
        wiz.prompt.destroy();
        wiz.prompt = blessed.textbox({
          parent: wiz.frame,
          top: 3, left: 2, right: 2, height: 1,
          border: { type: 'line', style: { fg: Color.gold } },
          inputOnFocus: true,
          keys: true,
          style: { fg: Color.parchment, bg: Color.shadow, focus: { border: { fg: Color.goldBright } } },
        });
        wiz.prompt.on('submit', (v2) => {
          const v = (v2 || '').toLowerCase().trim();
          if (v === 'm' || v === 'male') wiz.sex = 'male';
          else if (v === 'f' || v === 'female') wiz.sex = 'female';
          self._finishCharacterCreation(wiz.name, wiz.sex);
        });
        wiz.prompt.key(['escape'], () => self._closeCharacterCreation());
        wiz.prompt.focus();
        self.screen.render();
      });
      wiz.prompt.key(['escape'], () => self._closeCharacterCreation());
      wiz.prompt.focus();
    }
    // wiz.step === 'sex' branch is handled inside the name-step submit handler
    // (it destroys the name prompt and creates the sex prompt).
  }

  _randomName(sex) {
    const m = ['William', 'Thomas', 'Robert', 'Richard', 'Henry', 'Edward', 'Geoffrey', 'Walter', 'Roger', 'Hugh'];
    const f = ['Mary', 'Elizabeth', 'Margaret', 'Agnes', 'Alice', 'Joan', 'Emma', 'Catherine', 'Isabel', 'Eleanor'];
    const pool = sex === 'female' ? f : m;
    let idx;
    if (this.game && this.game.kernel && typeof this.game.kernel.random === 'function') {
      idx = this.game.kernel.random();
    } else {
      // Deterministic fallback when no kernel — pick by character index of sex.
      idx = (sex.charCodeAt(0) || 0) / 256;
    }
    return pool[Math.floor(idx * pool.length) % pool.length];
  }

  _finishCharacterCreation(name, sex) {
    if (!this.game.kernel) {
      this._closeCharacterCreation();
      this.log('No kernel — cannot create character.', 'error');
      return;
    }
    const result = this.game.createPlayer(name, sex);
    this._closeCharacterCreation();
    if (result && result.success) {
      this.log(`You are born as ${name}, a ${sex} child in ${result.settlement ? result.settlement.name : 'the realm'}.`, 'success');
      this.log('Your life begins. Type `look` to see where you are.', 'system');
      this.updateDisplay();
    } else {
      this.log(`Failed to create character: ${result ? result.error : 'unknown error'}`, 'error');
    }
  }

  _closeCharacterCreation() {
    if (!this._creationWizard) return;
    const wiz = this._creationWizard;
    if (wiz.prompt) {
      try { wiz.prompt.destroy(); } catch (_) { /* noop */ }
    }
    if (wiz.title) {
      try { wiz.title.destroy(); } catch (_) { /* noop */ }
    }
    if (wiz.hint) {
      try { wiz.hint.destroy(); } catch (_) { /* noop */ }
    }
    if (wiz.frame) {
      try { wiz.frame.destroy(); } catch (_) { /* noop */ }
    }
    this._creationWizard = null;
    this._showAllPanels(true);
    if (this.screen && !this.screen.destroyed) this.screen.render();
  }

  updateLocation() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);
    
    let content = '';
    
    // Environment info with colors
    content += `{bold}{green-fg}Biome:{/green-fg}{/bold} ${this.capitalize(tile.biome.type)}\n`;
    content += `{bold}{yellow-fg}Elevation:{/yellow-fg}{/bold} ${Math.floor(tile.terrain.elevation)}m\n`;
    content += `{bold}{red-fg}Temperature:{/red-fg}{/bold} ${Math.floor(tile.climate.temperature)}°C\n`;
    content += `{bold}{blue-fg}Weather:{/blue-fg}{/bold} ${tile.climate.rainfall > 5 ? 'Rainy 🌧️' : 'Clear ☀️'}\n\n`;
    
    // Ground items
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    if (groundItems.length > 0) {
      content += `{bold}{yellow-fg}Items on ground:{/yellow-fg}{/bold}\n`;
      for (const item of groundItems.slice(0, 5)) {
        content += `  {cyan-fg}•{/cyan-fg} ${item.type}${item.subtype ? ` (${item.subtype})` : ''} {gray-fg}[take/use]{/gray-fg}\n`;
      }
      if (groundItems.length > 5) {
        content += `  {gray-fg}... and ${groundItems.length - 5} more{/gray-fg}\n`;
      }
      content += '\n';
    }
    
    // Nearby people
    if (nearby.length > 1) {
      content += `{bold}{magenta-fg}Nearby People:{/magenta-fg}{/bold}\n`;
      let count = 0;
      for (const id of nearby) {
        if (id === player.id || count >= 8) continue;
        const entity = this.game.kernel.entities.get(id);
        if (entity && entity.name) {
          const occupationColor = entity.occupation === 'merchant' ? 'yellow' : 'white';
          content += `  {cyan-fg}•{/cyan-fg} {${occupationColor}-fg}${entity.name}{/${occupationColor}-fg} {gray-fg}(${entity.occupation}){/gray-fg}\n`;
          count++;
        }
      }
      if (nearby.length - 1 > count) {
        content += `  {gray-fg}... and ${nearby.length - 1 - count} others{/gray-fg}\n`;
      }
      content += '\n';
    }
    
    // Resources
    if (tile.resources.length > 0) {
      content += `{bold}{green-fg}Resources:{/green-fg}{/bold}\n`;
      for (const res of tile.resources.slice(0, 5)) {
        const remaining = res.amount - res.extracted;
        const color = remaining > 50 ? 'green' : remaining > 20 ? 'yellow' : 'red';
        content += `  {cyan-fg}•{/cyan-fg} {${color}-fg}${this.capitalize(res.type)}{/${color}-fg}: ${remaining}\n`;
      }
    }
    
    this.locationBox.setContent(content);
  }

  updateStatus() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    
    let content = '';
    
    // Health with color coding
    const healthPercent = (health.overall * 100).toFixed(0);
    const healthColor = health.overall > 0.7 ? 'green' : health.overall > 0.4 ? 'yellow' : 'red';
    content += `{bold}Health:{/bold} {${healthColor}-fg}${this.getBar(health.overall, 15)} ${healthPercent}%{/${healthColor}-fg}\n`;
    
    const painColor = health.pain < 3 ? 'green' : health.pain < 6 ? 'yellow' : 'red';
    content += `{bold}Pain:{/bold} {${painColor}-fg}${this.getBar(1 - health.pain / 10, 15)} ${health.pain.toFixed(1)}/10{/${painColor}-fg}\n`;
    
    const fatigueColor = health.fatigue < 0.4 ? 'green' : health.fatigue < 0.7 ? 'yellow' : 'red';
    content += `{bold}Fatigue:{/bold} {${fatigueColor}-fg}${this.getBar(1 - health.fatigue, 15)} ${(health.fatigue * 100).toFixed(0)}%{/${fatigueColor}-fg}\n\n`;
    
    // Needs
    content += `{bold}{cyan-fg}Basic Needs:{/cyan-fg}{/bold}\n`;
    
    const hungerColor = status.needs.hunger < 0.4 ? 'green' : status.needs.hunger < 0.7 ? 'yellow' : 'red';
    content += `  Hunger: {${hungerColor}-fg}${this.getBar(1 - status.needs.hunger, 12)}{/${hungerColor}-fg}\n`;
    
    const thirstColor = status.needs.thirst < 0.4 ? 'green' : status.needs.thirst < 0.7 ? 'yellow' : 'red';
    content += `  Thirst: {${thirstColor}-fg}${this.getBar(1 - status.needs.thirst, 12)}{/${thirstColor}-fg}\n`;
    
    const sleepColor = status.needs.sleep < 0.4 ? 'green' : status.needs.sleep < 0.7 ? 'yellow' : 'red';
    content += `  Sleep:  {${sleepColor}-fg}${this.getBar(1 - status.needs.sleep, 12)}{/${sleepColor}-fg}\n\n`;
    
    // Household
    const household = this.game.kernel.entities.get(player.household);
    if (household) {
      content += `{bold}{yellow-fg}Household:{/yellow-fg}{/bold}\n`;
      content += `  Members: {white-fg}${household.members.length}{/white-fg}\n`;
      content += `  Food: {green-fg}${household.food.toFixed(0)}{/green-fg}\n`;
      content += `  Wealth: {yellow-fg}${household.wealth.toFixed(0)}{/yellow-fg}\n`;
    }

    // ─── T2-6: currency display ────────────────────────────────────────
    const ws = this.game.getPlayerWealthSummary();
    if (ws) {
      content += `\n{bold}{magenta-fg}Currency:{/magenta-fg}{/bold}\n`;
      content += `  Purse: {white-fg}${ws.purse.gold}g ${ws.purse.silver}s ${ws.purse.copper}c{/white-fg} (≈ ${ws.liquidCopper}c)\n`;
      content += `  Player wealth: {yellow-fg}${ws.liquidCopper}{/yellow-fg}\n`;
      content += `  Household wealth: {yellow-fg}${ws.householdWealth}{/yellow-fg}\n`;
      content += `  Regional rate: {cyan-fg}${ws.regionalCurrency.toFixed(2)}×{/cyan-fg} (settlement #${ws.settlementId})\n`;
    }

    this.statusBox.setContent(content);
    
    // Update health gauge
    this.healthBar.setPercent(Math.floor(health.overall * 100));
  }

  updateActions() {
    const actions = [
      '{green-fg}[W]{/green-fg}ork',
      '{blue-fg}[S]{/blue-fg}leep',
      '{yellow-fg}[E]{/yellow-fg}at',
      '{cyan-fg}[L]{/cyan-fg}ook',
      '{magenta-fg}[M]{/magenta-fg}ove'
    ];
    
    this.actionsBox.setContent(actions.join('  '));
  }

  getBar(value, length) {
    const filled = Math.floor(value * length);
    const empty = length - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  log(message, type = 'info') {
    const colors = {
      'info':     Color.parchment,
      'action':   Color.sapphire,
      'success':  Color.forestBright,
      'error':    Color.crimson,
      'combat':   Color.burgundyBright,
      'system':   Color.gold,
    };

    const icons = {
      'info':    '•',
      'action':  '→',
      'success': '✓',
      'error':   '✗',
      'combat':  '⚔',
      'system':  '⚙',
    };

    const color = colors[type] || Color.parchment;
    const icon = icons[type] || '•';

    const turn = this.game && this.game.kernel ? this.game.kernel.turn : 0;
    const t = formatGameTime(turn);
    const ts = `{${Color.mute}-fg}${t.hh}:${t.mm}{/${Color.mute}-fg}`;

    if (this.messageLog && typeof this.messageLog.log === 'function') {
      this.messageLog.log(`${ts} {${color}-fg}${icon} ${message}{/${color}-fg}`);
    } else if (this.screen) {
      // No log widget — silent fallback for headless contexts.
    }
  }

  async handleCommand(input) {
    if (!input) return;
    
    const [command, ...args] = input.toLowerCase().split(' ');
    
    const commands = {
      'help': () => this.showHelp(args[0]),
      'quickstart': () => this.showQuickStart(),
      'qs': () => this.showQuickStart(),
      'start': () => this.startNewLife(),
      'look': () => this.look(),
      'l': () => this.look(),
      'status': () => this.showDetailedStatus(),
      'c': () => this.showDetailedStatus(),
      'inventory': () => this.showInventory(),
      'i': () => this.showInventory(),
      'move': () => this.move(args),
      'm': () => this.move(args),
      'take': () => this.take(args),
      'drop': () => this.drop(args),
      'eat': () => this.eat(args),
      'e': () => this.eat(args),
      'drink': () => this.drink(),
      'sleep': () => this.sleep(),
      's': () => this.sleep(),
      'work': () => this.work(),
      'w': () => this.work(),
      'talk': () => this.talk(args),
      'wait': () => this.wait(args),
      'propose': () => this.propose(args),
      'marry': () => this.acceptProposal(args),
      'family': () => this.showFamily(),
      'adopt': () => this.adoptChild(args),
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

      // Religion
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

      // Transportation
      'mount': () => this.mountHorse(args),
      'dismount': () => this.dismount(),
      'sail': () => this.sailTo(args),
      'drive': () => this.driveCart(args),
      'vehicles': () => this.listVehicles(),
      'stables': () => this.listStables(),
      'travel': () => this.travelTo(args),
      'fast-travel': () => this.fastTravel(args),

      // Governance rituals
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

      'titles': () => this.showTitles(),
      'claim-title': () => this.claimTitle(args),
      'grant-title': () => this.grantTitle(args),
      'house': () => this.showHouse(),
      'levy': () => this.raiseLevy(args),
      'court': () => this.holdCourt(),
      'spells': () => this.listSpells(),
      'learn': () => this.learnSpellCmd(args),
      'cast': () => this.castSpellCmd(args),
      'mana': () => this.showMana(),
      'shop': () => this.listShops(),
      'browse': () => this.browseShop(args),
      'buy': () => this.buyItem(args),
      'sell': () => this.sellItem(args),
      'haggle': () => this.haggleItem(args),
      'repay': () => this.repayLoan(args),
      'loans': () => this.listLoans(),
      'craft': () => this.craft(args),
      'gather': () => this.gatherResource(args),
      'harvest': () => this.harvestFlora(args),
      'hunt': () => this.huntAnimal(args),
      'forage': () => this.forage(),
      'plant': () => this.plantCrop(args),
      'gossip': () => this.gossip(args),
      'buy': () => this.buyItem(args),
      'sell': () => this.sellItem(args),
      'attack': () => this.attack(args),
      'dev': () => this.toggleDevMode(),
      'continue': () => this.continueAsHeir(args),
      'heirs': () => this.listHeirs(),
      'save': () => this.save(),
      'load': () => this.load(),
      'quit': () => process.exit(0),
      'exit': () => process.exit(0)
    };
    
    if (commands[command]) {
      try {
        await commands[command]();
      } catch (error) {
        this.log(`Error: ${error.message}`, 'error');
      }
    } else {
      this.log(`Unknown command: ${command}. Type "help" for commands.`, 'error');
    }
    
    this.screen.render();
  }

  _showBeginnerHelp() {
    const help = `
{center}{bold}{cyan-fg}A SHORT GUIDE FOR NEW PLAYERS{/cyan-fg}{/bold}{/center}

{bold}{gold-fg}What kind of game is this?{/gold-fg}
  Medieval Life Sim is a {bold}turn-based life simulator{/bold}.
  You live one life from birth to death: you eat, sleep,
  work, marry, have children, and one day your line continues
  through an heir. You do not control a character sheet —
  you control a {italic}person{/italic}.

{bold}{gold-fg}Step 1 — Start your life{/gold-fg}
  Type {white-fg}start{/white-fg}. You'll be asked for a name and a sex.
  Leave the name blank and we'll pick a period-appropriate
  name from Domesday Book and parish registers.

{bold}{gold-fg}Step 2 — Look around{/gold-fg}
  Type {white-fg}look{/white-fg} (or press {white-fg}L{/white-fg}). You'll see
  your biome, the weather, who is nearby, and what is on
  the ground. The map in the upper-left shows you in the world.

{bold}{gold-fg}Step 3 — Survive your first day{/gold-fg}
  Your four needs are {white-fg}hunger{/white-fg}, {white-fg}thirst{/white-fg}, {white-fg}sleep{/white-fg},
  and {white-fg}energy{/white-fg}. Watch them in the "Vitals Trend"
  panel.
    {white-fg}eat{/white-fg}    — eat food (or {white-fg}E{/white-fg})
    {white-fg}drink{/white-fg}  — drink water (or {white-fg}D{/white-fg})
    {white-fg}sleep{/white-fg}  — rest until morning (or {white-fg}S{/white-fg})
    {white-fg}work{/white-fg}   — earn a living (or {white-fg}W{/white-fg})

{bold}{gold-fg}Step 4 — Find a home and a trade{/white-fg}
  Type {white-fg}move n/s/e/w{/white-fg} (or {white-fg}M{/white-fg}) to walk. Walk to a
  settlement ({white-fg}#{/white-fg} on the map) and {white-fg}work{/white-fg} to learn a
  trade. Each settlement has a {white-fg}shop{/white-fg} you can {white-fg}buy{/white-fg}
  from and {white-fg}sell{/white-fg} to.

{bold}{gold-fg}Step 5 — Make a family{/white-fg}
  Type {white-fg}talk{/white-fg} to people nearby. When you find someone
  you like, type {white-fg}propose <their name>{/white-fg}. They may say
  yes. Type {white-fg}family{/white-fg} to see your lineage.

{bold}{gold-fg}What happens when you die?{/white-fg}
  When your character dies, the game offers you a list of
  eligible heirs (your children, by default). Pick one to
  continue the chronicle. Or type {white-fg}start{/white-fg} to begin
  a brand new line.

{bold}{gold-fg}Single-key shortcuts{/gold-fg}
  Most common actions have a single-letter shortcut that
  works from anywhere on the screen (except when you're
  typing in the command box). Press {white-fg}?{/white-fg} to see them.

{center}{gold-fg}Try {white-fg}quickstart{/white-fg}{gold-fg} for a 5-minute guided tour.{/gold-fg}{/center}
`;
    this.messageLog.log(help);
    this.screen.render();
  }

  showQuickStart() {
    const lines = [
      `{${Color.goldBright}-fg}${Glyph.fleur}  Quick Start — your first 5 minutes{/}`,
      '',
      `  {${Color.parchment}-fg}1. {${Color.gold}-fg}start{/}            {${Color.parchmentDim}-fg}— name yourself, pick sex{/}`,
      `  {${Color.parchment}-fg}2. {${Color.gold}-fg}look{/}  (or {${Color.goldDeep}-fg}L{/})      {${Color.parchmentDim}-fg}— see your surroundings{/}`,
      `  {${Color.parchment}-fg}3. {${Color.gold}-fg}move e{/}           {${Color.parchmentDim}-fg}— walk east one tile{/}`,
      `  {${Color.parchment}-fg}4. {${Color.gold}-fg}work{/}  (or {${Color.goldDeep}-fg}W{/})      {${Color.parchmentDim}-fg}— earn money at your trade{/}`,
      `  {${Color.parchment}-fg}5. {${Color.gold}-fg}eat{/}   (or {${Color.goldDeep}-fg}E{/})     {${Color.parchmentDim}-fg}— eat if you're hungry{/}`,
      `  {${Color.parchment}-fg}6. {${Color.gold}-fg}sleep{/} (or {${Color.goldDeep}-fg}S{/})     {${Color.parchmentDim}-fg}— rest when tired{/}`,
      `  {${Color.parchment}-fg}7. {${Color.gold}-fg}talk <name>{/}      {${Color.parchmentDim}-fg}— greet someone nearby{/}`,
      '',
      `  {${Color.parchmentDim}-fg}Type {${Color.gold}-fg}help beginner{/} for a longer walkthrough.{/}`,
    ];
    if (this.messageLog && typeof this.messageLog.log === 'function') {
      lines.forEach((l) => this.messageLog.log(l));
    } else {
      lines.forEach((l) => this.log(l.replace(/\{[^}]+\}/g, ''), 'info'));
    }
    this.screen.render();
  }

  showHelp(tier) {
    const t = (tier || '').toLowerCase();
    if (t === 'beginner' || t === 'beginners' || t === 'first' || t === 'new') {
      return this._showBeginnerHelp();
    }
    if (t === 'quick' || t === 'quickstart' || t === 'qs') {
      return this.showQuickStart();
    }
    const help = `
{center}{bold}{cyan-fg}COMMAND REFERENCE{/cyan-fg}{/bold}{/center}

{bold}{green-fg}Getting started:{/green-fg}{/bold}
  {white-fg}help beginner{/white-fg}  - Short guide for new players
  {white-fg}quickstart (qs){/white-fg} - 5-minute tour of the basics

{bold}{green-fg}Character:{/green-fg}{/bold}
  {white-fg}start{/white-fg}     - Begin a new life
  {white-fg}status{/white-fg}    - View detailed status
  {white-fg}inventory{/white-fg} - View inventory
  {white-fg}family{/white-fg}    - View family tree
  {white-fg}heirs{/white-fg}     - List eligible heirs
  {white-fg}dev{/white-fg}       - Toggle dev mode

{bold}{yellow-fg}Actions:{/yellow-fg}{/bold}
  {white-fg}look (l){/white-fg}   - Examine surroundings
  {white-fg}move (m){/white-fg}   - Move (n/s/e/w)
  {white-fg}take/get{/white-fg}  - Pick up item
  {white-fg}drop{/white-fg}      - Drop item
  {white-fg}eat (e){/white-fg}    - Consume food
  {white-fg}drink{/white-fg}     - Drink water
  {white-fg}sleep (s){/white-fg}   - Rest
  {white-fg}work (w){/white-fg}    - Work at occupation
  {white-fg}wait/rest{/white-fg} - Pass time
  {white-fg}gather/harvest/hunt/forage{/white-fg} - Natural-world actions
  {white-fg}craft <recipe>{/white-fg} - Craft an item

{bold}{magenta-fg}Social:{/magenta-fg}{/bold}
  {white-fg}talk{/white-fg}      - Talk to nearby person
  {white-fg}propose{/white-fg}    - Propose marriage
  {white-fg}marry{/white-fg}      - Accept a proposal
  {white-fg}divorce{/white-fg}    - End marriage
  {white-fg}adopt/orphans{/white-fg} - Family actions
  {white-fg}barter/loan{/white-fg} - Trade/barter
  {white-fg}faction(s)/form-faction{/white-fg} - Factions
  {white-fg}join/leave-faction/alliance/guild{/white-fg}

{bold}{red-fg}Warfare & Politics:{/red-fg}{/bold}
  {white-fg}declare-war/muster/siege{/white-fg}
  {white-fg}declare-battle/battle(-round)/march/retreat/assault{/white-fg}
  {white-fg}betray/scheme/spy/coup/intrigues{/white-fg}

{bold}{cyan-fg}Land & Law:{/cyan-fg}{/bold}
  {white-fg}claim-land/buy-land/sell-land/annex-land/land{/white-fg}
  {white-fg}steal/accuse/laws/cases/enact-law{/white-fg}

{bold}{yellow-fg}Titles, Religion, Magic, Transport:{/yellow-fg}{/bold}
  {white-fg}titles/claim-title/grant-title/house/levy/court{/white-fg}
  {white-fg}prayer/offering/ritual/prophecy/temples/clergy/ordain/bless/exorcise/pilgrimage/sacrifice{/white-fg}
  {white-fg}spells/learn/cast/mana{/white-fg}
  {white-fg}mount/dismount/sail/drive/vehicles/stables/travel/fast-travel{/white-fg}
  {white-fg}elect/coronate/abdicate/regent/dynasty/propose-law/sign-treaty/ratify/vassal/hold-council{/white-fg}

{bold}{green-fg}Knowledge:{/green-fg}{/bold}
  {white-fg}study/apprentice/discover/observe{/white-fg}
  {white-fg}recipes/cook/cure/infect{/white-fg}
  {white-fg}languages/culture{/white-fg}

{bold}{blue-fg}Trading:{/blue-fg}{/bold}
  {white-fg}shop/browse/buy/sell/haggle{/white-fg}

{bold}{blue-fg}System:{/blue-fg}{/bold}
  {white-fg}save{/white-fg}      - Save game
  {white-fg}load{/white-fg}      - Load game
  {white-fg}help{/white-fg}      - Show this help
  {white-fg}quit{/white-fg}      - Exit game
`;
    this.locationBox.setContent(help);
    this.log('Help displayed', 'system');
  }

  startNewLife() {
    if (this.game.player) {
      this.log('You already have an active life.', 'error');
      return;
    }
    if (!this.game.kernel) throw new Error('kernel required');
    this._openCharacterCreation();
  }

  look() {
    const player = this.game.getPlayer();
    if (!player) {
      this.log('No active character. Use "start" to begin.', 'error');
      return;
    }
    
    this.updateDisplay();
    this.log('You look around carefully.', 'action');
  }

  showDetailedStatus() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const status = player.getStatus();
    const health = player.physiology.getHealthStatus();
    
    let content = `
{center}{bold}{cyan-fg}${status.name.toUpperCase()}{/cyan-fg}{/bold}{/center}
{center}Age ${status.age} | ${status.sex} | ${status.occupation}{/center}

{bold}{green-fg}Health Status:{/green-fg}{/bold}
  Overall: ${this.getBar(health.overall, 20)} ${(health.overall * 100).toFixed(0)}%
  Pain:    ${this.getBar(1 - health.pain / 10, 20)} ${health.pain.toFixed(1)}/10
  Fatigue: ${this.getBar(1 - health.fatigue, 20)} ${(health.fatigue * 100).toFixed(0)}%

{bold}{cyan-fg}Basic Needs:{/cyan-fg}{/bold}
  Hunger: ${this.getBar(1 - status.needs.hunger, 20)} ${((1 - status.needs.hunger) * 100).toFixed(0)}%
  Thirst: ${this.getBar(1 - status.needs.thirst, 20)} ${((1 - status.needs.thirst) * 100).toFixed(0)}%
  Sleep:  ${this.getBar(1 - status.needs.sleep, 20)} ${((1 - status.needs.sleep) * 100).toFixed(0)}%
`;
    
    if (player.inventory.items.length > 0) {
      content += `\n{bold}{yellow-fg}Inventory:{/yellow-fg}{/bold}\n`;
      for (const item of player.inventory.items.slice(0, 10)) {
        content += `  • ${item.type}${item.subtype ? ` (${item.subtype})` : ''} [${item.mass}kg]\n`;
      }
    }

    // ─── T2-6: currency display ────────────────────────────────────────
    const ws = this.game.getPlayerWealthSummary();
    if (ws) {
      content += `\n{bold}{magenta-fg}Wealth & Currency:{/magenta-fg}{/bold}\n`;
      content += `  Purse: {white-fg}${ws.purse.gold}g ${ws.purse.silver}s ${ws.purse.copper}c{/white-fg}\n`;
      content += `  Player wealth: {yellow-fg}${ws.liquidCopper}c{/yellow-fg}\n`;
      content += `  Household wealth: {yellow-fg}${ws.householdWealth}{/yellow-fg}\n`;
      content += `  Regional rate: {cyan-fg}${ws.regionalCurrency.toFixed(2)}×{/cyan-fg} (settlement #${ws.settlementId})\n`;
    }

    this.locationBox.setContent(content);
    this.log('Status displayed', 'system');
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
    }
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
      this.log('Invalid direction. Use: n/s/e/w', 'error');
      return;
    }
    
    const dx = directions[dir].x;
    const dy = directions[dir].y;
    const traveler = this.game.transportation?.getTraveler?.(player.id);
    if (traveler && this.game.transportation) {
      const r = this.game.transportation.travel(player, dx, dy);
      if (r?.success) {
        this.game.kernel.entityIndex.update(player);
        this.game.advanceTurns(Math.max(1, r.ticks));
        this.log(`You move ${dir} (mounted).`, 'action');
        this.updateDisplay();
        return;
      }
    }
    player.position.x += dx;
    player.position.y += dy;
    if (this.game.transportation?._clampPosition) this.game.transportation._clampPosition(player.position);

    this.game.kernel.entityIndex.update(player);
    this.game.advanceTurns(1);

    this.log(`You move ${dir}.`, 'action');
    this.updateDisplay();
  }

  take(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length === 0) {
      this.log('Take what? Specify an item name.', 'error');
      return;
    }
    
    const itemName = args.join(' ');
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    
    const itemIndex = groundItems.findIndex(item => 
      item.type.toLowerCase().includes(itemName)
    );
    
    if (itemIndex === -1) {
      this.log(`There is no "${itemName}" here.`, 'error');
      return;
    }
    
    const item = groundItems[itemIndex];
    
    if (player.inventory.getWeight() + item.mass > player.inventory.capacity) {
      this.log(`The ${item.type} is too heavy.`, 'error');
      return;
    }
    
    groundItems.splice(itemIndex, 1);
    if (groundItems.length === 0) {
      this.groundItems.delete(locKey);
    } else {
      this.groundItems.set(locKey, groundItems);
    }
    
    player.inventory.add(item);
    this.game.advanceTurns(1);
    
    this.log(`You pick up the ${item.type}.`, 'success');
    this.updateDisplay();
  }

  drop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    if (args.length === 0) {
      this.log('Drop what? Specify an item name.', 'error');
      return;
    }
    
    const itemName = args.join(' ');
    const item = player.inventory.items.find(i => 
      i.type.toLowerCase().includes(itemName)
    );
    
    if (!item) {
      this.log(`You don't have any "${itemName}".`, 'error');
      return;
    }
    
    player.inventory.remove(item.type, 1);
    
    const locKey = `${player.position.x},${player.position.y}`;
    const groundItems = this.groundItems.get(locKey) || [];
    groundItems.push(item);
    this.groundItems.set(locKey, groundItems);
    
    this.game.advanceTurns(1);
    
    this.log(`You drop the ${item.type}.`, 'action');
    this.updateDisplay();
  }

  eat(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    
    const itemType = args.join(' ') || 'food';
    const food = player.inventory.find(i => i.type === itemType || i.subtype === itemType);
    
    if (!food) {
      this.log(`You don't have any ${itemType}.`, 'error');
      return;
    }
    
    player.physiology.consume(food);
    player.inventory.remove(food.type, 1);
    player.needs.satisfy('hunger', 0.5);
    
    this.game.advanceTurns(1);
    this.log(`You eat the ${food.type}.`, 'action');
    this.updateDisplay();
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

  sleep() {
    const player = this.game.getPlayer();
    if (!player) return;
    
    this.log('You sleep...', 'action');
    this.game.advanceTurns(8);
    
    player.needs.satisfy('sleep', 1.0);
    player.physiology.fatigue = 0;
    
    this.log('You wake up refreshed.', 'success');
    this.updateDisplay();
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
      this.log(`Earned ${(productivity * 10).toFixed(0)} wealth.`, 'success');
    }
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
    this.updateDisplay();
  }

  talk(args) {
    const player = this.game.getPlayer();
    if (!player) return;

    if (args.length === 0) {
      this.log('Talk to whom?', 'error');
      return;
    }

    const targetName = args.join(' ');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, player.position.z, 10);

    let target = null;
    for (const id of nearby) {
      if (id === player.id) continue;
      const entity = this.game.kernel.entities.get(id);
      if (entity && entity.name && entity.name.toLowerCase().includes(targetName.toLowerCase())) {
        target = entity;
        break;
      }
    }

    if (!target) {
      this.log(`There is no one named "${targetName}" nearby.`, 'error');
      return;
    }

    this.game.advanceTurns(1);
    this.log(`You approach ${target.name}.`, 'action');
    this.log(`${target.name}: "Greetings, traveler."`, 'info');
    // Write to per-person relationships (source of truth) AND legacy Social.Relationships.
    const personalRel = player.relationships.get(target.id);
    const legacyRel = this.game.relationships.getBond(player.id, target.id);
    const nextAffinity = (personalRel?.affinity ?? 0) + 0.1;
    player.relationships.set(target.id, { affinity: Math.min(1, nextAffinity), trust: personalRel?.trust ?? 0.3, respect: personalRel?.respect ?? 0.3 });
    target.relationships.set(player.id, { affinity: Math.min(1, nextAffinity), trust: personalRel?.trust ?? 0.3, respect: personalRel?.respect ?? 0.3 });
    if (!legacyRel) this.game.relationships.createBond(player.id, target.id, 0.1);
    else this.game.relationships.modifyAffinity(player.id, target.id, 0.1);
    if (player.skills?.train) player.skills.train('persuasion', 'social', 0.5, 1);
  }

  wait(args) {
    const turns = parseInt(args[0]) || 1;
    this.game.advanceTurns(turns);
    this.log(`${turns} turn(s) pass...`, 'action');
    this.updateDisplay();
  }

  save() {
    try {
      const saveData = this.game.save();
      const saveDir = path.join(process.cwd(), 'saves');
      
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `save_${this.game.player?.name || 'unknown'}_${timestamp}.json`;
      const filepath = path.join(saveDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(saveData, null, 2));
      
      this.log(`Game saved to: ${filename}`, 'success');
    } catch (error) {
      this.log(`Failed to save: ${error.message}`, 'error');
    }
  }

  load() {
    try {
      const saveDir = path.join(process.cwd(), 'saves');
      if (!fs.existsSync(saveDir)) {
        this.log('No saves directory found.', 'error');
        return;
      }
      const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        this.log('No save files found.', 'error');
        return;
      }
      const latest = files.sort().reverse()[0];
      const filepath = path.join(saveDir, latest);
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
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
    if (player && player.alive) {
      this.log('Your character is still alive.', 'error');
      return;
    }
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
    const player = this.game.getPlayer();
    if (player && player.alive) {
      this.log('You are still alive.', 'error');
      return;
    }
    if (!this.game.kinship) {
      this.log('No kinship data.', 'error');
      return;
    }
    const deadId = this.game.player?.id;
    const heirs = this.game.kinship.getEligibleHeirs(deadId).filter(id => {
      const h = this.game.kernel.entities.get(id);
      return h && h.alive && h.canSucceed();
    });
    if (heirs.length === 0) {
      this.log('No eligible heirs.', 'error');
      return;
    }
    for (let i = 0; i < heirs.length; i++) {
      const h = this.game.kernel.entities.get(heirs[i]);
      this.log(`  ${i + 1}. ${h.name} (age ${Math.floor(h.age)}, ${h.occupation})`, 'info');
    }
    this.log('Use "continue <number>" to play as an heir.', 'system');
  }

  toggleDevMode() {
    this.devMode = !this.devMode;
    this.log(`Developer mode ${this.devMode ? 'ON' : 'OFF'}.`, 'system');
    this.updateDisplay();
  }

  propose(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (player.age < 16) { this.log(`You are too young to marry (${Math.floor(player.age)}). Must be 16+.`, 'error'); return; }
    if (player.marriage?.spouse) { this.log('You are already married.', 'error'); return; }
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.age >= 16 && p !== player && !p.marriage?.spouse && (args[0] ? p.name.toLowerCase().includes(args[0].toLowerCase()) : true));
    if (!target) { this.log('No eligible unmarried person nearby.', 'error'); return; }
    const r = this.game.marriage.propose(player, target);
    this.game.advanceTurns(60);
    if (r.success) this.log(`Married ${target.name}!`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
  }
  acceptProposal(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const proposals = Array.from(this.game.marriage.proposals.values()).filter(p => p.target === player.id && p.status === 'pending');
    if (!proposals.length) { this.log('No pending proposals.', 'info'); return; }
    const proposer = this.game.kernel.entities.get(proposals[0].proposer);
    const r = this.game.marriage.marry(proposer, player);
    this.game.advanceTurns(60);
    if (r.success) this.log(`Married ${proposer.name}!`, 'success');
    else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
  }
  showFamily() {
    const player = this.game.getPlayer();
    if (!player) return;
    const tree = this.game.marriage.getFamilyTree?.(player);
    if (!tree) { this.log('No family data.', 'info'); return; }
    this.log(`Family of ${player.name}:`, 'system');
    if (tree.spouse) {
      const s = this.game.kernel.entities.get(tree.spouse);
      if (s) this.log(`  Spouse: ${s.name} (age ${Math.floor(s.age)})`, 'info');
    }
    if (tree.parents?.mother) {
      const m = this.game.kernel.entities.get(tree.parents.mother);
      if (m) this.log(`  Mother: ${m.name}`, 'info');
    }
    if (tree.parents?.father) {
      const f = this.game.kernel.entities.get(tree.parents.father);
      if (f) this.log(`  Father: ${f.name}`, 'info');
    }
    for (const cid of tree.children || []) {
      const c = this.game.kernel.entities.get(cid);
      if (c) this.log(`  Child: ${c.name} (age ${Math.floor(c.age)}, ${c.sex})`, 'info');
    }
  }
  listShops() {
    const player = this.game.getPlayer();
    if (!player) return;
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    if (!shops.length) { this.log('No shops nearby.', 'info'); return; }
    for (const s of shops) this.log(`  ${s.name} (${s.type}) — reputation ${(s.reputation*100).toFixed(0)}%`, 'info');
    this.log('Use "browse <name>" to view inventory, "buy <item>" to purchase.', 'system');
    this.updateDisplay();
  }

  // ─── T2-3: shop handlers with proper item-type/subtype resolution ───
  _pickShop(args) {
    const player = this.game.getPlayer();
    if (!player) return null;
    const shops = this.game.trading.getShopsNear(player.position.x, player.position.y);
    if (!shops.length) return null;
    if (args.length === 0) return shops[0];
    const arg = args.join(' ').toLowerCase();
    const byIndex = parseInt(arg, 10);
    if (!isNaN(byIndex) && byIndex >= 1 && byIndex <= shops.length) return shops[byIndex - 1];
    return shops.find(s => s.name.toLowerCase().includes(arg)) || shops[0];
  }

  browseShop(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const shop = this._pickShop(args);
    if (!shop) return this.log('No shops nearby.', 'error');
    const r = this.game.trading.browseShop(shop.id);
    if (!r.success) return this.log(r.reason, 'error');
    this.log(`${shop.name}:`, 'system');
    if (!r.items.length) return this.log('  (Out of stock)', 'info');
    let i = 1;
    for (const it of r.items) {
      this.log(`  ${i}. ${it.subtype} — ${it.price} copper (${it.quantity} in stock)`, 'info');
      i++;
    }
    this.log('Use "buy <n-or-name>" / "sell <n-or-name>" / "haggle <item> <price>".', 'system');
    this.updateDisplay();
  }

  buyItem(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: buy <item-name-or-#> [qty]', 'error');
    const shop = this._pickShop([]);
    if (!shop) return this.log('No shops nearby.', 'error');
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
    this.log(r.success ? (r.message || `Bought from ${shop.name}.`) : `Failed: ${r.reason}`,
              r.success ? 'success' : 'error');
    this.updateDisplay();
  }

  sellItem(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: sell <item-name-or-#> [qty]', 'error');
    const shop = this._pickShop([]);
    if (!shop) return this.log('No shops nearby.', 'error');
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
    this.log(r.success ? (r.message || `Sold to ${shop.name}.`) : `Failed: ${r.reason}`,
              r.success ? 'success' : 'error');
    this.updateDisplay();
  }

  haggleItem(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: haggle <item> <price>', 'error');
    const targetPrice = parseInt(args[args.length - 1], 10);
    if (isNaN(targetPrice)) return this.log('Bad price.', 'error');
    const itemName = args.slice(0, -1).join(' ');
    const shop = this._pickShop([]);
    if (!shop) return this.log('No shops nearby.', 'error');
    const browse = this.game.trading.browseShop(shop.id);
    if (!browse.success) return this.log(browse.reason, 'error');
    const item = browse.items.find(i => i.subtype.toLowerCase().includes(itemName.toLowerCase()));
    if (!item) return this.log('Item not stocked here.', 'error');
    const r = this.game.trading.haggle(player, shop.id, item.type, item.subtype, targetPrice);
    this.log(r.success ? r.message : `Refused: ${r.reason}`, r.success ? 'success' : 'error');
  }

  // ─── T2-7: loans ─────────────────────────────────────────────────────
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
  craft(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: craft <recipe>', 'error');
    const r = this.game.crafting.craft(player, args.join(' '), player.inventory, this.game.kernel);
    if (!r.success) return this.log(`Cannot craft: ${r.reason}`, 'error');
    this.game.advanceTurns(r.turnsRequired || 60);
    player.inventory.add(r.item);
    this.log(`Crafted ${r.item.type}!`, 'success');
    if (player.skills?.train) {
      const recipeSkill = {
        tool: ['metalwork', 'crafting'],
        weapon: ['metalwork', 'crafting'],
        clothing: ['textiles', 'crafting'],
        shelter: ['construction', 'crafting'],
        food: ['foraging', 'survival']
      }[args[0]] || ['woodwork', 'crafting'];
      player.skills.train(recipeSkill[0], recipeSkill[1], 0.6, r.turnsRequired || 60);
    }
    this.updateDisplay();
  }
  gatherResource(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: gather <resource>', 'error');
    const tileKey = `${player.position.x},${player.position.y}`;
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    const resource = tile.resources?.find(r => r.type === args[0].toLowerCase() || (r.subtype && r.subtype.toLowerCase().includes(args[0].toLowerCase())));
    if (!resource) return this.log(`No ${args[0]} here.`, 'error');
    const gathered = { type: resource.type, subtype: resource.subtype || resource.type, quantity: 1, mass: 0.5 };
    if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
    const result = player.inventory.add(gathered);
    if (result && result.success === false) return this.log(`Inventory full: ${result.reason || 'too heavy'}`, 'error');
    resource.extracted = (resource.extracted || 0) + 1;
    this.game.advanceTurns(8);
    this.log(`Gathered 1 ${gathered.subtype}.`, 'success');
    if (player.skills?.train) player.skills.train('foraging', 'survival', 0.5, 8);
    this.updateDisplay();
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
      let skipped = 0;
      for (const item of (r.yield || [])) {
        const ar = player.inventory.add(item);
        if (ar && ar.success === false) skipped++;
      }
      if (skipped > 0) this.log(`Skipped ${skipped} items (inventory full).`, 'error');
      this.game.advanceTurns(5);
      this.log(`Harvested ${r.species}.`, 'success');
    } else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
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
      let skipped = 0;
      for (const item of (r.yield || [])) {
        const ar = player.inventory.add(item);
        if (ar && ar.success === false) skipped++;
      }
      if (skipped > 0) this.log(`Skipped ${skipped} items (inventory full).`, 'error');
      this.game.advanceTurns(5);
      this.log(`Hunted successfully!`, 'success');
    } else this.log(`Failed: ${r.reason}`, 'error');
    this.updateDisplay();
  }
  forage() {
    const player = this.game.getPlayer();
    if (!player) return;
    const tileKey = `${player.position.x},${player.position.y}`;
    const floraIds = this.game.naturalWorld.floraByTile.get(tileKey) || [];
    const forageable = floraIds.map(id => this.game.naturalWorld.flora.get(id)).filter(f => f && f.harvestable && (f.type === 'herb' || f.type === 'mushroom' || f.type === 'bush'));
    if (!forageable.length) return this.log('Nothing to forage.', 'error');
    const r = this.game.naturalWorld.harvestFlora(forageable[0].id);
    if (r.success) {
      if (!player.inventory?.add) player.inventory = { items: [], add(x){this.items.push(x);} };
      let skipped = 0;
      for (const item of (r.yield || [])) {
        const ar = player.inventory.add(item);
        if (ar && ar.success === false) skipped++;
      }
      if (skipped > 0) this.log(`Skipped ${skipped} items (inventory full).`, 'error');
      this.game.advanceTurns(4);
      this.log(`Foraged.`, 'success');
    } else this.log(`Failed.`, 'error');
    this.updateDisplay();
  }
  plantCrop(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: plant <crop>', 'error');
    if (!this.game.agriculture) return this.log('Agriculture unavailable.', 'error');
    const crop = args.join(' ').toLowerCase();
    const tile = this.game.world.getTile(player.position.x, player.position.y);
    if (!tile) return this.log('No tile here.', 'error');
    const result = this.game.agriculture.plant
      ? this.game.agriculture.plant(player.position.x, player.position.y, crop)
      : { success: false, reason: 'plant() not implemented' };
    if (result.success) {
      this.game.advanceTurns(30);
      this.log(`Planted ${crop}.`, 'success');
    } else this.log(`Could not plant: ${result.reason}`, 'error');
    this.updateDisplay();
  }
  gossip(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const peer = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10)
      .map(id => this.game.kernel.entities.get(id))
      .find(p => p && p !== player && p.alive && p.age >= 12 && p.name);
    if (!peer) return this.log('No one nearby.', 'error');
    if (!this.game.reputation?.makeClaim) return this.log('Reputation unavailable.', 'error');
    let subject;
    if (args.length > 0) subject = this.game.kernel.entities.get(parseInt(args[0], 10));
    if (!subject) subject = Array.from(this.game.kernel.alivePeople || []).find(p => p && p !== player && p !== peer);
    if (!subject) return this.log('No one to gossip about.', 'error');
    const claim = this.game.reputation.makeClaim(player, subject, 'honest', 0.5 + this.game.kernel.random() * 0.3, { type: 'witnessed' });
    const r = claim ? this.game.reputation.propagateClaim(claim.id, player, peer, { medium: 'conversation' }) : null;
    if (r && r.success) {
      this.game.advanceTurns(5);
      this.log(`Gossiped with ${peer.name} about ${subject.name}.`, 'success');
    } else this.log(`Gossip failed${r?.reason ? ': ' + r.reason : ''}.`, 'error');
    this.updateDisplay();
  }
  buyItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (!this.game.trading) return this.log('Trading unavailable.', 'error');
    const sid = player.position?.settlementId;
    const shop = Array.from(this.game.trading.shops?.values?.() || []).find(s => s && s.settlementId === sid);
    if (!shop) return this.log('No shop here.', 'error');
    const good = (args[0] || '').toLowerCase();
    const stock = Array.from(shop.inventory?.keys?.() || []);
    const found = stock.find(k => k.toLowerCase().includes(good));
    if (!found) return this.log(`No ${good} here.`, 'error');
    const [t, st] = found.split('_');
    const r = this.game.trading.buyItem(player, shop.id, t, st, 1);
    if (r.success) {
      this.game.advanceTurns(2);
      this.log(`Bought 1× ${found} for ${r.cost}.`, 'success');
    } else this.log(r.reason || 'Cannot buy.', 'error');
    this.updateDisplay();
  }
  sellItem(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (!this.game.trading) return this.log('Trading unavailable.', 'error');
    const sid = player.position?.settlementId;
    const shop = Array.from(this.game.trading.shops?.values?.() || []).find(s => s && s.settlementId === sid);
    if (!shop) return this.log('No shop here.', 'error');
    const good = (args[0] || '').toLowerCase();
    const have = (player.inventory?.items || []).find(i => i && (i.type === good || (i.name || '').toLowerCase().includes(good)));
    if (!have) return this.log(`No ${good} to sell.`, 'error');
    const r = this.game.trading.sellItem(player, shop.id, have.type || 'misc', have.subtype || '', 1);
    if (r.success) {
      this.game.advanceTurns(2);
      this.log(`Sold for ${r.cost}.`, 'success');
    } else this.log(r.reason || 'Cannot sell.', 'error');
    this.updateDisplay();
  }
  attack(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: attack <person>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 5);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p !== player && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const weapon = player.inventory?.find?.(i => i.type === 'weapon');
    const r = Combat.resolveAttack(player, target, weapon, 'torso', this.game.kernel);
    this.game.advanceTurns(1);
    if (r.hit) {
      this.log(`Hit ${target.name} in ${r.location} for ${(r.damage*100).toFixed(0)}% damage.`, 'combat');
      if (target.physiology?.checkVitals && !target.physiology.checkVitals().alive && target.alive) {
        target.die('combat', this.game.kernel);
        this.log(`${target.name} has died!`, 'combat');
      }
    } else this.log(`Missed ${target.name}.`, 'combat');
    this.updateDisplay();
  }

  listOrphans() {
    const player = this.game.getPlayer();
    if (!player) return;
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    if (orphans.length === 0) { this.log('No orphans nearby.', 'info'); return; }
    this.log(`Orphans nearby (${orphans.length}):`, 'system');
    for (let i = 0; i < orphans.length; i++) {
      this.log(`  ${i + 1}. ${orphans[i].name} (age ${Math.floor(orphans[i].age)})`, 'info');
    }
    this.log('Use "adopt <number>" to adopt.', 'system');
  }

  adoptChild(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (player.age < 18) { this.log('You must be 18+ to adopt.', 'error'); return; }
    const orphans = this.game.marriage.findOrphansNear(player.position.x, player.position.y, 20);
    if (orphans.length === 0) { this.log('No orphans nearby.', 'error'); return; }
    const num = parseInt(args[0]) || 1;
    if (num < 1 || num > orphans.length) { this.log(`Pick 1-${orphans.length}.`, 'error'); return; }
    const result = this.game.marriage.adopt(player, orphans[num - 1]);
    this.game.advanceTurns(1);
    if (result.success) this.log(`Adopted ${orphans[num - 1].name}!`, 'success');
    else this.log(`Adoption failed: ${result.reason}`, 'error');
    this.updateDisplay();
  }

  listFactions() {
    const factions = this.game.factions?.factions;
    if (!factions || factions.size === 0) { this.log('No factions. Use "form-faction <name>" to create one.', 'system'); return; }
    for (const [, f] of factions) this.log(`  ${f.id}. ${f.name} [${f.purpose}] — ${f.members.length} members`, 'info');
  }

  formFaction(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: form-faction <name> [purpose]', 'error'); return; }
    const result = this.game.factions.createFaction(args.join(' '), player, 'social', {});
    this.game.advanceTurns(1);
    if (result.success) this.log(`Faction "${args.join(' ')}" founded.`, 'success');
    this.updateDisplay();
  }

  warfareStatus() {
    const w = this.game.warfare;
    this.log(`⚔  ${w.armies.size} armies, ${w.battles.size} battles, ${w.sieges.size} sieges`, 'system');
    this.updateDisplay();
  }

  claimLand(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) { this.log('Usage: claim-land <x> <y>', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const result = this.game.landOwnership.registerClaim(x, y, player, 'Claim by right of presence');
    this.game.advanceTurns(1);
    if (result.success) this.log(`Claim filed on (${x},${y}).`, 'success');
    else this.log(`Failed: ${result.reason}`, 'error');
    this.updateDisplay();
  }

  buyLand(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) { this.log('Usage: buy-land <x> <y>', 'error'); return; }
    const x = parseInt(args[0]); const y = parseInt(args[1]);
    const sid = player.position?.settlementId ?? 0;
    const price = this.game.landOwnership.getLandPrice(x, y, sid);
    if (price === null) { this.log('No parcel there.', 'error'); return; }
    const result = this.game.landOwnership.buyLand(x, y, player, price);
    this.game.advanceTurns(1);
    if (result.success) this.log(`Bought (${x},${y}) for ${price} copper.`, 'success');
    else this.log(`Failed: ${result.reason}`, 'error');
    this.updateDisplay();
  }

  showLand(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const x = args[0] ? parseInt(args[0]) : player.position.x;
    const y = args[1] ? parseInt(args[1]) : player.position.y;
    const parcel = this.game.landOwnership.getParcel(x, y);
    if (!parcel) { this.log(`No parcel at (${x},${y}).`, 'info'); return; }
    const owner = typeof parcel.owner === 'number' ? this.game.kernel.entities.get(parcel.owner)?.name || `#${parcel.owner}` : (parcel.owner || 'unclaimed');
    this.log(`(${x},${y}): value=${parcel.value}, owner=${owner}`, 'info');
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
    if (soldiers.length === 0) { this.log('No one will follow you.', 'error'); return; }
    const army = this.game.warfare.musterArmy(player, soldiers, { x: player.position.x, y: player.position.y });
    this.game.advanceTurns(60);
    this.log(`Army ${army.id} mustered: ${soldiers.length} soldiers.`, 'success');
    this.updateDisplay();
  }

  barter(args) {
    if (args.length < 3) { this.log('Usage: barter <person> <yourItem>=<theirItem>', 'error'); return; }
    const player = this.game.getPlayer();
    if (!player) return;
    const targetName = args[0];
    const m = `${args[1]}=${args[2]}`.match(/^([a-z]+)=([a-z]+)$/i);
    if (!m) { this.log('Format: <item>=<item>', 'error'); return; }
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(targetName.toLowerCase()) && p !== player);
    if (!target) { this.log(`No "${targetName}" nearby.`, 'error'); return; }
    const result = this.game.trading.barter(player, target, m[1].toLowerCase(), m[2].toLowerCase());
    this.game.advanceTurns(1);
    if (result.success) this.log(result.message, 'success');
    else this.log(`Refused: ${result.reason}`, 'error');
    this.updateDisplay();
  }

  study(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: study <subject> [hours]', 'error'); return; }
    const subject = args[0];
    const hours = parseInt(args[1]) || 4;
    const r = this.game.education.selfStudy(player, subject, hours, ['basic_tools']);
    this.game.advanceTurns(hours * 60);
    this.log(r?.success === false ? `Failed: ${r.reason}` : `Studied ${subject} ${hours}h.`, r?.success === false ? 'error' : 'success');
  }

  startApprenticeship(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) { this.log('Usage: apprentice <master> <craft>', 'error'); return; }
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const master = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()) && p !== player && p.age >= 18);
    if (!master) { this.log(`No "${args[0]}" nearby.`, 'error'); return; }
    const r = this.game.education.createApprenticeship(master, player, args[1], 365 * 3);
    this.game.advanceTurns(60);
    this.log(r?.success === false ? `Failed: ${r.reason}` : `Apprenticed to ${master.name}.`, r?.success === false ? 'error' : 'success');
  }

  attemptDiscovery(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: discover <technology>', 'error'); return; }
    const r = this.game.technology.attemptDiscovery(player, args[0], { tools: 1 }, 'tinkering');
    this.game.advanceTurns(480);
    this.log(r?.success ? `Discovered ${args[0]}!` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }

  observePhenomenon(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: observe <phenomenon>', 'error'); return; }
    this.game.knowledge.observe(player, args.join('_'), { location: player.position });
    this.game.advanceTurns(30);
    this.log(`Observed ${args.join(' ')}.`, 'success');
  }

  listRecipes() {
    const recipes = this.game.foodSystem.recipes || {};
    this.log(`Recipes: ${Object.keys(recipes).slice(0, 8).join(', ')}...`, 'system');
  }

  cook(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) { this.log('Usage: cook <recipe>', 'error'); return; }
    const r = this.game.foodSystem.cook(args.join(' '), player.inventory?.items || [], 0.5, ['fire']);
    this.game.advanceTurns(60);
    this.log(r?.success === false ? `Failed: ${r.reason}` : `Cooked ${args.join(' ')}.`, r?.success === false ? 'error' : 'success');
  }

  treatDisease(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const infections = this.game.pathogens.getActiveInfections(player.id);
    if (!infections?.length) { this.log('No active infections.', 'info'); return; }
    const r = this.game.treatment.administer(player, player, args.join(' ') || 'willow_bark', { herbs: 1 });
    this.game.advanceTurns(120);
    this.log(r?.success ? `Treatment applied.` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }

  declareBattle(args) {
    if (args.length < 2) { this.log('Usage: declare-battle <armyId> <enemyId> [terrain]', 'error'); return; }
    const r = this.game.warfare.engageBattle(parseInt(args[0]), parseInt(args[1]), args[2] || 'plains');
    this.game.advanceTurns(60);
    if (r.success) this.log(`⚔ Battle ${r.battle.id} begun!`, 'combat');
    else this.log(`Failed: ${r.reason}`, 'error');
  }
  battleStatus() {
    const bs = this.game.warfare.getActiveBattles();
    const ss = this.game.warfare.getActiveSieges();
    for (const b of bs) {
      const a1 = this.game.warfare.getArmy(b.armies[0]); const a2 = this.game.warfare.getArmy(b.armies[1]);
      this.log(`⚔ Battle ${b.id} (${b.terrain}): A${a1.id}[${a1.soldiers.length},m${a1.morale.toFixed(2)}] vs A${a2.id}[${a2.soldiers.length},m${a2.morale.toFixed(2)}] round ${b.rounds.length}`, 'combat');
    }
    for (const s of ss) {
      const a = this.game.warfare.getArmy(s.attacker); const d = this.game.warfare.getArmy(s.defender);
      this.log(`🏰 Siege ${s.id}: A ${a.soldiers.length} vs D ${d.soldiers.length}`, 'combat');
    }
    if (!bs.length && !ss.length) this.log('No active battles or sieges.', 'info');
  }
  battleRound(args) {
    const bs = this.game.warfare.getActiveBattles();
    if (!bs.length) { this.log('No active battles.', 'info'); return; }
    const b = args[0] ? bs.find(x => x.id === parseInt(args[0])) : bs[0];
    if (!b) return;
    const r = this.game.warfare.simulateBattleRound(b.id);
    this.game.advanceTurns(60);
    if (r.success) this.log(`Round ${r.round.round}: casualties ${JSON.stringify(r.round.casualties)}. ${r.ongoing ? 'Continues.' : 'Ended.'}`, 'combat');
    else this.log(`Failed: ${r.reason}`, 'error');
  }
  marchArmy(args) {
    if (args.length < 3) return this.log('Usage: march <armyId> <x> <y>', 'error');
    const r = this.game.warfare.march(parseInt(args[0]), { x: parseInt(args[1]), y: parseInt(args[2]) }, 10);
    this.game.advanceTurns(60);
    this.log(r.success ? `Marched.` : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
  }
  retreatArmy(args) {
    if (args.length < 1) return this.log('Usage: retreat <armyId>', 'error');
    const r = this.game.warfare.retreat(parseInt(args[0]));
    this.game.advanceTurns(60);
    this.log(`Retreated — ${r.casualties} casualties.`, 'combat');
  }
  assaultSiege(args) {
    if (args.length < 1) return this.log('Usage: assault <siegeId>', 'error');
    const r = this.game.warfare.assault(parseInt(args[0]));
    this.game.advanceTurns(120);
    this.log(r.success ? `Assault: ${r.assault.success ? 'SUCCESS' : 'FAILED'}` : `Failed: ${r.reason}`, r.success ? 'combat' : 'error');
  }
  startSiege(args) {
    if (args.length < 2) return this.log('Usage: siege <attackerArmyId> <defenderArmyId>', 'error');
    const r = this.game.warfare.startSiege(parseInt(args[0]), parseInt(args[1]), null);
    this.game.advanceTurns(60);
    this.log(r.success ? `🏰 Siege ${r.siege.id} begun!` : `Failed: ${r.reason}`, r.success ? 'combat' : 'error');
  }
  betrayFaction(args) {
    if (args.length < 1) return this.log('Usage: betray <factionId> [reason]', 'error');
    const player = this.game.getPlayer();
    const fid = parseInt(args[0]);
    const reason = args.slice(1).join(' ') || 'personal';
    const r = this.game.factions.betray(fid, player.id, reason);
    this.game.advanceTurns(60);
    this.log(r.message || (r.success ? 'Betrayed.' : 'Failed.'), r.success ? 'combat' : 'error');
  }
  runScheme(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return this.log('Usage: scheme <targetFactionId> [type]', 'error');
    const own = this.game.factions.getFactionsByMember(player.id)[0];
    const r = this.game.factions.scheme(player.id, own?.id ?? null, parseInt(args[0]), args[1] || 'espionage');
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
  }
  runEspionage(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return this.log('Usage: spy <governmentId> [op]', 'error');
    const r = this.game.politics.conductEspionage(player, parseInt(args[0]), args[1] || 'reconnaissance');
    this.game.advanceTurns(60);
    this.log(r.message, r.success ? 'combat' : 'error');
    if (r.secrets?.length) this.log(`  Secrets: ${r.secrets.join(', ')}`, 'system');
  }
  runCoup(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 1) return this.log('Usage: coup <governmentId> [reason]', 'error');
    const r = this.game.politics.attemptCoup(parseInt(args[0]), player, [], args.slice(1).join(' ') || 'overthrow');
    this.game.advanceTurns(480);
    this.log(r.message, r.success ? 'combat' : 'error');
  }
  listIntrigues() {
    const b = this.game.factions.getBetrayals();
    const s = this.game.factions.getSchemes();
    const c = this.game.politics.getCoups();
    const e = this.game.politics.getEspionage();
    for (const x of b.slice(-3)) this.log(`🗡 Betrayal: ${x.person} betrayed ${x.faction} — ${x.reason}`, 'combat');
    for (const x of s.slice(-3)) this.log(`🕵 Scheme: ${x.type} → ${x.target}`, 'combat');
    for (const x of c.slice(-3)) this.log(`👑 Coup: ${x.government} — ${x.success ? 'OK' : 'failed'}`, 'combat');
    for (const x of e.slice(-3)) this.log(`🔍 Spy: ${x.operation} → ${x.target}`, 'combat');
    if (!b.length && !s.length && !c.length && !e.length) this.log('No intrigues yet.', 'info');
  }
  stealItem(args) {
    if (args.length === 0) return this.log('Usage: steal <person> [index]', 'error');
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
    this.log(r.success ? `Accusation filed: case ${r.case.id}.` : `Failed: ${r.reason}`, r.success ? 'combat' : 'error');
  }
  listLaws() {
    const laws = this.game.law.getActiveLaws();
    if (!laws.length) { this.log('No laws yet. Try "enact-law theft_wave" or similar.', 'info'); return; }
    for (const l of laws) this.log(`  ${l.id}. ${l.name} [${l.penalty.type}]`, 'info');
  }
  listCases() {
    const player = this.game.getPlayer();
    if (!player) return;
    const all = [...this.game.law.getCasesByAccused(player.id), ...this.game.law.getCasesByAccuser(player.id)];
    if (!all.length) { this.log('No cases.', 'info'); return; }
    for (const c of all) this.log(`  Case ${c.id}: ${c.crimeType} (${c.status})`, 'system');
  }
  enactDynamicLaw(args) {
    if (args.length === 0) return this.log('Usage: enact-law <eventType>', 'error');
    const player = this.game.getPlayer();
    const r = this.game.triggerDynamicLaw(args[0], player?.position?.settlementId);
    this.log(r.success ? `Law "${r.law.name}" enacted.` : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
  }

  showTitles() {
    const player = this.game.getPlayer();
    if (!player) return;
    const current = this.game.titles.getTitle(player);
    this.log(`Your title: ${current}`, 'system');
    for (const rank of this.game.titles.getTitleRanks()) {
      const e = this.game.titles.checkEligibility(player, rank);
      const mark = current === rank ? '★' : (e.eligible ? '○' : '·');
      this.log(`  ${mark} ${rank}${e.eligible && current !== rank ? ' (eligible!)' : ''}`, 'info');
    }
  }
  claimTitle(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: claim-title <rank>', 'error');
    const e = this.game.titles.checkEligibility(player, args[0]);
    if (!e.eligible) return this.log(`Not eligible: ${e.reason}`, 'error');
    const r = this.game.titles.grant(player, args[0]);
    this.game.advanceTurns(60);
    this.log(r.success ? `✦ You are now ${args[0]}!` : `Failed.`, r.success ? 'success' : 'error');
    this.updateDisplay();
  }
  grantTitle(args) {
    if (args.length < 2) return this.log('Usage: grant-title <person> <rank>', 'error');
    const player = this.game.getPlayer();
    const t = this.game.titles.getTitle(player);
    if (!['king','duke','count','baron'].includes(t)) return this.log(`Only nobles can grant titles. You are a ${t}.`, 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p !== player && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log(`No "${args[0]}" nearby.`, 'error');
    const r = this.game.titles.grant(target, args[1], player);
    this.game.advanceTurns(60);
    this.log(r.success ? `Granted ${args[1]} to ${target.name}.` : 'Failed.', r.success ? 'success' : 'error');
  }
  showHouse() {
    const player = this.game.getPlayer();
    if (!player) return;
    const house = this.game.titles.getHouseForPerson(player.id);
    if (!house) return this.log('No house.', 'info');
    this.log(`${house.name} — members: ${house.members.length}, treasury: ${house.treasury}`, 'system');
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
    this.log(r.success ? `Court held.` : 'Failed.', r.success ? 'success' : 'error');
  }
  listSpells() {
    const player = this.game.getPlayer();
    if (!player) return;
    const known = this.game.magic.getKnownSpells(player);
    this.log(`Spells: ${known.join(', ') || '(none)'}`, 'system');
  }
  learnSpellCmd(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: learn <spell>', 'error');
    const r = this.game.magic.learnSpell(player, args[0], 8);
    this.game.advanceTurns(480);
    this.log(r.success ? `Studied ${args[0]}.` : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
  }
  castSpellCmd(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: cast <spell>', 'error');
    const r = this.game.magic.cast(player, args[0], player);
    this.game.advanceTurns(30);
    this.log(r.success ? `Cast!${r.backlash ? ' (backlash!)' : ''}` : `Failed: ${r.reason}`, r.success ? 'success' : 'error');
  }
  showMana() {
    const player = this.game.getPlayer();
    if (!player) return;
    const pool = this.game.magic.getPool(player);
    this.log(`Mana: ${Math.floor(pool.current)}/${pool.max}`, 'system');
  }

  // ─── Religion ──────────────────────────────────────────────────────

  pray(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.religion?.pray?.(player, parseInt(args[0]) || 0, args[1] || 'private');
    this.game.advanceTurns(15);
    this.log(r?.success ? `Prayer offered.` : `Contemplated silently.`, r?.success ? 'success' : 'info');
  }
  makeOffering(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: offering <food|drink|wealth>', 'error');
    const itemMap = { food: 'food', drink: 'drink', wealth: 'coin', incense: 'herb', animal: 'meat' };
    const r = this.game.religion?.makeOffering?.(player, 0, { type: args[0].toLowerCase(), item: itemMap[args[0].toLowerCase()] || args[0] });
    this.game.advanceTurns(10);
    this.log(r?.success ? `Offering accepted.` : `Cannot offer: ${r?.reason || 'unavailable'}`, r?.success ? 'success' : 'error');
  }
  performRitual(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: ritual <type>', 'error');
    const r = this.game.religion?.performRitual?.(player, args[0], []);
    this.game.advanceTurns(60);
    this.log(r?.success ? `Ritual performed.` : `Failed.`, r?.success ? 'success' : 'error');
  }
  showProphecy() {
    const p = this.game.religion?.prophecies || [];
    if (!p.length) return this.log('No prophecies.', 'info');
    this.log(`"${p[p.length - 1].text}"`, 'system');
  }
  listTemples() {
    const temples = this.game.religion?.temples ? [...this.game.religion.temples.values()] : [];
    for (const t of temples) this.log(`  Temple #${t.id} (clergy: ${t.clergy?.length || 0})`, 'info');
    if (!temples.length) this.log('No temples.', 'info');
  }
  listClergy() {
    const clergy = this.game.religion?.clergy ? [...this.game.religion.clergy.values()] : [];
    for (const c of clergy) {
      const p = this.game.kernel.entities.get(c.personId);
      this.log(`  ${c.role}: ${p?.name || c.personId}`, 'info');
    }
    if (!clergy.length) this.log('No clergy.', 'info');
  }
  ordainClergy(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: ordain <person> <role>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log('Not found.', 'error');
    const r = this.game.religion?.ordainClergy?.(target, args[1]);
    this.log(r?.success ? `Ordained as ${args[1]}.` : `Failed.`, r?.success ? 'success' : 'error');
  }
  blessFollower(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    if (args.length === 0) return this.log('Usage: bless <person>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log('Not found.', 'error');
    target.morale = Math.min(1, (target.morale || 0.5) + 0.2);
    this.game.advanceTurns(30);
    this.log(`Blessed ${target.name}.`, 'success');
  }
  exorcise() {
    const player = this.game.getPlayer();
    if (!player || !player.clergy) return this.log('Only clergy can exorcise.', 'error');
    this.game.advanceTurns(120);
    this.log(`Rites performed.`, 'info');
  }
  goPilgrimage(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: pilgrimage <settlement>', 'error');
    const target = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase()));
    if (!target) return this.log('No such settlement.', 'error');
    player.position.x = target.x;
    player.position.y = target.y;
    this.game.advanceTurns(60);
    this.log(`Pilgrimage complete.`, 'success');
  }
  sacrifice(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: sacrifice <item>', 'error');
    const inv = player.inventory?.items || [];
    const found = inv.find(i => i.type === args[0].toLowerCase() || i.subtype === args[0].toLowerCase());
    if (!found) return this.log(`No ${args[0]} to sacrifice.`, 'error');
    if (player.inventory.remove) player.inventory.remove(found.type, 1);
    this.game.advanceTurns(15);
    this.log(`Sacrificed ${found.type}.`, 'success');
  }

  // ─── Transportation ────────────────────────────────────────────────

  mountHorse(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: mount <vehicleId>', 'error');
    const r = this.game.transportation?.mountVehicle?.(player, parseInt(args[0]));
    this.log(r?.success ? `Mounted ${r.vehicle.name}.` : `Failed: ${r?.reason || 'unknown'}`, r?.success ? 'success' : 'error');
  }
  dismount() {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.transportation?.dismount?.(player);
    this.log(r?.success ? `Dismounted.` : r?.reason || 'Not mounted.', r?.success ? 'success' : 'error');
  }
  sailTo(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: sail <dx> <dy>', 'error');
    const r = this.game.transportation?.sail?.(player, parseInt(args[0]), parseInt(args[1]));
    if (r?.success) this.game.advanceTurns(r.ticks);
    this.log(r?.success ? `Sailed ${r.distance.toFixed(1)} tiles.` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }
  driveCart(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: drive <dx> <dy>', 'error');
    const r = this.game.transportation?.drive?.(player, parseInt(args[0]), parseInt(args[1]));
    if (r?.success) this.game.advanceTurns(r.ticks);
    this.log(r?.success ? `Drove ${r.distance.toFixed(1)} tiles.` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }
  listVehicles() {
    const v = this.game.transportation ? [...this.game.transportation.vehicles.values()] : [];
    if (!v.length) return this.log('No vehicles.', 'info');
    const byType = {};
    for (const x of v) byType[x.type] = (byType[x.type] || 0) + 1;
    this.log(`${v.length} vehicles: ${Object.entries(byType).map(([t,n]) => `${t}:${n}`).join(', ')}`, 'system');
  }
  listStables() {
    const player = this.game.getPlayer();
    if (!player) return;
    const sid = player.position?.settlementId ?? 0;
    const stable = this.game.transportation?.getStable?.(sid) || [];
    for (const x of stable) this.log(`  #${x.id} ${x.name}`, 'info');
    if (!stable.length) this.log('No stable here.', 'info');
  }
  travelTo(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: travel <settlement>', 'error');
    const target = (this.game.world?.settlements || []).find(s => s.name.toLowerCase().includes(args.join(' ').toLowerCase()));
    if (!target) return this.log('No such settlement.', 'error');
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const r = this.game.transportation?.travel?.(player, dx, dy);
    if (r?.success) {
      this.game.advanceTurns(r.ticks);
      this.log(`Traveled to ${target.name}.`, 'success');
    } else this.log(`Failed: ${r?.reason}`, 'error');
  }
  fastTravel(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: fast-travel <routeId>', 'error');
    const r = this.game.transportation?.fastTravel?.(player, args[0]);
    this.log(r?.success ? `Fast-traveled.` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }

  // ─── Governance ────────────────────────────────────────────────────

  holdElection(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: elect <governmentId>', 'error');
    const candidates = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 50)
      .map(id => this.game.kernel.entities.get(id)).filter(p => p && p.alive && p.age >= 25).slice(0, 5);
    if (!candidates.length) return this.log('No candidates.', 'error');
    const r = this.game.politics?.holdElection?.(parseInt(args[0]), candidates);
    this.game.advanceTurns(60);
    if (r?.success) {
      const w = this.game.kernel.entities.get(r.winner);
      this.log(`Election: ${w?.name || r.winner} wins.`, 'success');
    } else this.log(`Failed: ${r?.reason}`, 'error');
  }
  coronate(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: coronate <governmentId>', 'error');
    const r = this.game.politics?.coronate?.(parseInt(args[0]), player);
    this.game.advanceTurns(120);
    this.log(r?.success ? `👑 Crowned.` : `Failed: ${r?.reason}`, r?.success ? 'success' : 'error');
  }
  abdicateThrone() {
    const player = this.game.getPlayer();
    if (!player) return;
    const gov = [...this.game.politics.governments.values()].find(g => g.ruler === player.id);
    if (!gov) return this.log('You rule no government.', 'error');
    const r = this.game.politics.abdicate(gov.id, player, null);
    this.game.advanceTurns(120);
    this.log('Abdicated.', 'system');
  }
  appointRegent(args) {
    const player = this.game.getPlayer();
    if (!player || args.length === 0) return this.log('Usage: regent <person>', 'error');
    const nearby = this.game.kernel.queryEntitiesNear(player.position.x, player.position.y, 0, 10);
    const target = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p.name && p.name.toLowerCase().includes(args[0].toLowerCase()));
    if (!target) return this.log('Not found.', 'error');
    const gov = [...this.game.politics.governments.values()].find(g => g.ruler === player.id);
    if (!gov) return this.log('You rule no government.', 'error');
    const r = this.game.politics.appointRegent(gov.id, target);
    this.game.advanceTurns(60);
    this.log(r?.success ? `Regent appointed.` : 'Failed.', r?.success ? 'success' : 'error');
  }
  showDynasty() {
    const player = this.game.getPlayer();
    if (!player) return;
    const d = this.game.politics?.getDynasty?.(player.dynasty);
    this.log(d ? `${d.name} — ${d.monarchs.length} monarchs` : 'No dynasty.', d ? 'system' : 'info');
  }
  proposeLawCmd(args) {
    const player = this.game.getPlayer();
    if (!player) return;
    const r = this.game.triggerDynamicLaw('plague_outbreak', player.position?.settlementId);
    this.log(r?.success ? `Law "${r.law.name}" proposed.` : 'Failed.', r?.success ? 'success' : 'error');
  }
  signTreaty(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: sign-treaty <govA> <govB>', 'error');
    const r = this.game.politics?.signTreaty?.(parseInt(args[0]), parseInt(args[1]));
    this.log(r?.success ? 'Treaty signed.' : 'Failed.', r?.success ? 'success' : 'error');
  }
  ratifyTreaty(args) {
    if (args.length === 0) return this.log('Usage: ratify <treatyId>', 'error');
    const t = this.game.politics?.treaties?.get?.(args[0]);
    if (!t) return this.log('No treaty.', 'error');
    t.active = true;
    this.log('Ratified.', 'success');
  }
  makeVassal(args) {
    if (args.length < 2) return this.log('Usage: vassal <vassalGov> <liegeGov>', 'error');
    const r = this.game.politics?.makeVassal?.(parseInt(args[0]), parseInt(args[1]));
    this.log(r?.success ? 'Vassalage established.' : 'Failed.', r?.success ? 'success' : 'error');
  }
  holdCouncil(args) {
    const player = this.game.getPlayer();
    if (!player || args.length < 2) return this.log('Usage: hold-council <govId> <proposal>', 'error');
    const gov = this.game.politics.governments.get(parseInt(args[0]));
    if (!gov) return this.log('No such government.', 'error');
    const voters = (gov.subjects || []).slice(0, 8).map(id => this.game.kernel.entities.get(id)).filter(Boolean);
    const r = this.game.politics.holdCouncilSession(gov.id, args.slice(1).join(' '), voters);
    this.game.advanceTurns(120);
    this.log(`Council vote: ${r.session.passed ? 'PASSED' : 'FAILED'} (for ${r.session.tally.for}, against ${r.session.tally.against}).`, r.session.passed ? 'success' : 'error');
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
