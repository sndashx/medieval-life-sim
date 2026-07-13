// Game action dispatcher — every slash-command and key shortcut resolves to
// a method on this object. Methods run the actual Game logic and pipe any
// resulting messages into the store's log.

import { G } from './theme.js';
import { Game } from '../../Game.js';

export class Actions {
  constructor(game, store) {
    this.game = game;
    this.store = store;
    this.handlers = new Map();
  }

  _emit(msg, type = 'info') {
    if (msg == null) return;
    if (Array.isArray(msg)) msg = msg.join('\n');
    this.store.log(msg, type);
  }

  _table(rows, opts = {}) {
    const w = opts.width || 64;
    const lines = [];
    for (const r of rows) lines.push(r);
    this._emit(lines.join('\n'));
  }

  // ── Core lifecycle ──────────────────────────────────────────────────────
  async start(nameOrOpts = 'Adventurer', sexArg = null) {
    if (this.game.player) { this._emit('You already have an active life.', 'error'); return; }
    let name, sex;
    if (typeof nameOrOpts === 'object' && nameOrOpts !== null) {
      name = nameOrOpts.name || 'Adventurer';
      sex = nameOrOpts.sex || null;
    } else {
      name = nameOrOpts || 'Adventurer';
      sex = sexArg;
    }
    if (!sex) sex = this.game.kernel.random() > 0.5 ? 'male' : 'female';
    const result = this.game.createPlayer(name, sex);
    if (!result.success) { this._emit(`Could not begin life: ${result.error || 'unknown'}`, 'error'); return; }
    this._emit(`${G.fleur}  You are born as ${name}, a ${sex} child of ${result.household.name || 'a peasant household'} in ${result.settlement.name}.`, 'success');
    this._emit(`${G.spark}  Your life begins. Type ${G.swashOpen}help${G.swashClose} for guidance.`, 'info');
  }

  async look() {
    const p = this.game.player;
    if (!p) { this._emit('Begin a life first (start).', 'error'); return; }
    const settlement = (p.position?.settlementId != null)
      ? this.game.world?.settlements?.[p.position.settlementId]
      : null;
    if (settlement) {
      this._emit(`${G.tower} ${settlement.name} — ${settlement.type || 'hamlet'}, pop. ${settlement.population ?? '?'}`, 'info');
    }
    if (p.needs) {
      const n = p.needs;
      const flags = [];
      if (n.hunger < 0.3) flags.push('fed');
      if (n.thirst < 0.3) flags.push('hydrated');
      if (n.sleep < 0.3) flags.push('rested');
      if (flags.length) this._emit(`${G.fleur}  You are ${flags.join(', ')}.`, 'good');
      if (n.hunger > 0.7) this._emit(`${G.bullet}  You are hungry.`, 'warn');
      if (n.thirst > 0.7) this._emit(`${G.bullet}  You are thirsty.`, 'warn');
      if (n.sleep > 0.7) this._emit(`${G.bullet}  You are weary.`, 'warn');
    }
  }

  async status() {
    const p = this.game.player;
    if (!p) { this._emit('No active character. Use start.', 'error'); return; }
    const phys = p.physiology || {};
    const meta = phys.metabolism || {};
    const rows = [];
    rows.push(`${G.crown} ${p.name} — ${p.age.toFixed(1)} years, ${p.sex}, ${p.occupation}`);
    rows.push(`  ${G.heart}  health   ${(phys.bloodVolume || 0).toFixed(0)} / ${(phys.initialBloodVolume || 1).toFixed(0)}`);
    rows.push(`  ${G.bolt}  energy   ${(meta.energyStores || 0).toFixed(0)} / ${(meta.maxEnergyStores || 1).toFixed(0)}`);
    rows.push(`  ${G.crown2} body temp ${(phys.coreTemperature || 0).toFixed(1)}°`);
    const inv = p.inventory?.items?.length || 0;
    const spouse = p.marriage?.spouse != null ? this.game.kernel.entities.get(p.marriage.spouse)?.name : '—';
    rows.push(`  ${G.castle}  household  ${p.household != null ? `household #${p.household}` : '—'}   ${G.heartEmpty} spouse: ${spouse}`);
    rows.push(`  ${G.bag}  inventory (${inv} items)`);
    this._table(rows);
  }

  async inventory() {
    const p = this.game.player;
    if (!p) { this._emit('No active character.', 'error'); return; }
    const items = p.inventory?.items || [];
    if (items.length === 0) { this._emit(`${G.bag}  You carry nothing.`, 'info'); return; }
    const rows = [`${G.bag}  Inventory`];
    items.forEach((it, i) => {
      const n = it.name || it.type || 'item';
      const q = it.quantity > 1 ? ` ×${it.quantity}` : '';
      const note = it.nutrition ? ` (${it.nutrition} nutrition)` : '';
      rows.push(`  ${i + 1}. ${n}${q}${note}`);
    });
    this._table(rows);
  }

  async move(args) {
    const dir = (args?.[0] || '').toLowerCase();
    const dirs = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
    const d = dirs[dir] || dir;
    if (!d) { this._emit('Usage: move <n|s|e|w>', 'error'); return; }
    const p = this.game.player;
    if (!p?.position) { this._emit('No position.', 'error'); return; }
    const dx = { east: 1, west: -1 }[d] || 0;
    const dy = { south: 1, north: -1 }[d] || 0;
    const dz = { up: 1, down: -1 }[d] || 0;
    p.position.x = (p.position.x || 0) + dx;
    p.position.y = (p.position.y || 0) + dy;
    p.position.z = (p.position.z || 0) + dz;
    this.game.advanceTurns(15);
    this._emit(`${G.arrowR}  You travel ${d}.`, 'info');
  }

  async take(args) {
    const idx = parseInt(args?.[0] || '0', 10);
    const items = this._nearbyItems();
    if (!items[idx]) { this._emit('Nothing to take there.', 'error'); return; }
    const p = this.game.player;
    p.inventory?.add?.(items[idx]);
    this._emit(`${G.bag}  You pick up ${items[idx].name || 'an item'}.`, 'good');
  }

  async drop(args) {
    const idx = parseInt(args?.[0] || '0', 10);
    const p = this.game.player;
    const items = p.inventory?.items || [];
    const it = items[idx];
    if (!it) { this._emit('You have nothing to drop.', 'error'); return; }
    p.inventory.remove?.(idx);
    this._emit(`${G.bullet}  You drop ${it.name || 'an item'}.`, 'info');
  }

  async eat() {
    const p = this.game.player;
    if (!p?.needs) { this._emit('No active character.', 'error'); return; }
    const food = (p.inventory?.items || []).findIndex(i => i.type === 'food' || i.subtype === 'food' || i.nutrition);
    if (food < 0) { this._emit(`${G.flower}  You have no food.`, 'warn'); return; }
    const it = p.inventory.items[food];
    const nut = it.nutrition || 0.3;
    p.needs.satisfy('hunger', nut);
    p.needs.satisfy('thirst', nut * 0.3);
    p.inventory.remove?.(food);
    this.game.advanceTurns(20);
    this._emit(`${G.flower}  You eat ${it.name || 'a meal'}. (-${nut.toFixed(2)} hunger)`, 'good');
  }

  async drink() {
    const p = this.game.player;
    if (!p?.needs) { this._emit('No active character.', 'error'); return; }
    p.needs.satisfy('thirst', 0.5);
    this.game.advanceTurns(10);
    this._emit(`${G.water}  You drink. (-0.50 thirst)`, 'good');
  }

  async sleep() {
    const p = this.game.player;
    if (!p?.needs) { this._emit('No active character.', 'error'); return; }
    p.needs.satisfy('sleep', 0.9);
    if (p.physiology?.fatigue != null) p.physiology.fatigue = Math.max(0, p.physiology.fatigue - 0.6);
    this.game.advanceTurns(480); // ~8 hours
    this._emit(`${G.moon}  You rest until dawn. The world moves on...`, 'info');
  }

  async work() {
    this.game.advanceTurns(120);
    const p = this.game.player;
    if (p?.needs) p.needs.hunger = Math.min(1, p.needs.hunger + 0.1);
    const occ = p?.occupation || 'peasant';
    const lines = [
      `${G.iron}  You labor at your trade (${occ}).`,
      `  ${G.bolt}  Energy spent. Hunger rises.`,
    ];
    if (p?.physiology?.metabolism) p.physiology.metabolism.energyStores = Math.max(0, (p.physiology.metabolism.energyStores || 0) - 100);
    this._table(lines);
  }

  async wait(args) {
    const mins = parseInt(args?.[0] || '60', 10);
    this.game.advanceTurns(mins);
    this._emit(`${G.crescent}  ${mins} minutes pass.`, 'info');
  }

  async talk() {
    this.game.advanceTurns(10);
    this._emit(`${G.cross}  You exchange words with a neighbour.`, 'info');
  }

  async propose() {
    this.game.advanceTurns(30);
    this._emit(`${G.heart}  You offer a proposal of marriage.`, 'info');
  }

  async family() {
    const p = this.game.player;
    if (!p) { this._emit('No active character.', 'error'); return; }
    const rows = [`${G.fleur}  ${p.name} — family`];
    rows.push(`  ${G.crown2}  father: ${p.kinship?.father != null ? this.game.kernel.entities.get(p.kinship.father)?.name || '—' : '—'}`);
    rows.push(`  ${G.crown2}  mother: ${p.kinship?.mother != null ? this.game.kernel.entities.get(p.kinship.mother)?.name || '—' : '—'}`);
    const kids = (p.kinship?.children || []).map(id => this.game.kernel.entities.get(id)).filter(c => c && c.alive);
    if (kids.length) {
      rows.push(`  ${G.flower}  children:`);
      for (const k of kids) rows.push(`     ${G.bullet} ${k.name}, ${k.sex}, ${k.age.toFixed(1)}y (${k.occupation})`);
    } else {
      rows.push(`  ${G.flower}  no children`);
    }
    this._table(rows);
  }

  async faction() {
    const facs = this.game.factions?.factions || new Map();
    if (facs.size === 0) { this._emit(`${G.shield}  No factions yet in the realm.`, 'info'); return; }
    const rows = [`${G.shield}  Factions`];
    for (const [, f] of facs) {
      const leader = f.leader != null ? this.game.kernel.entities.get(f.leader)?.name || '—' : '—';
      rows.push(`  ${G.fleur} ${f.name}  ${G.arrowR} ${f.purpose}  · ${f.members.length} members  · ${leader}`);
    }
    this._table(rows);
  }

  async warfare() {
    const wars = this.game.factions?.conflicts || new Map();
    if (wars.size === 0) { this._emit(`${G.sword}  The realm is at peace.`, 'good'); return; }
    const rows = [`${G.sword}  Conflicts`];
    for (const [, c] of wars) {
      const a = this.game.factions.factions.get(c.factions?.[0])?.name || '?';
      const b = this.game.factions.factions.get(c.factions?.[1])?.name || '?';
      rows.push(`  ${G.bolt}  ${a} ${G.sword} ${b}  (${c.intensity || '?'})`);
    }
    this._table(rows);
  }

  async titles() {
    const p = this.game.player;
    const title = p?.titles?.current || (p?.isPlayer && p?.isRuler) ? 'Ruler' : null;
    if (!title) { this._emit(`${G.crown}  You hold no title.`, 'info'); return; }
    this._emit(`${G.crown}  ${title}`, 'good');
  }

  async dynasty() {
    const p = this.game.player;
    const heirs = this.game.kinship?.getEligibleHeirs?.(p.id) || [];
    if (heirs.length === 0) { this._emit(`${G.crown}  No eligible heirs.`, 'info'); return; }
    const rows = [`${G.crown}  Heirs`];
    heirs.forEach((id, i) => {
      const h = this.game.kernel.entities.get(id);
      if (h && h.alive) rows.push(`  ${i + 1}. ${h.name}  · ${h.sex}  · ${h.age.toFixed(0)}y  · ${h.occupation}`);
    });
    this._table(rows);
  }

  async continue(args) {
    const idx = parseInt(args?.[0] || '0', 10) - 1;
    if (idx < 0) {
      this._emit('Usage: continue <number>', 'error');
      await this.dynasty();
      return;
    }
    const r = this.game.continueAsHeir(idx);
    if (!r.success) { this._emit(`Cannot continue: ${r.error}`, 'error'); return; }
    this._emit(`${G.crown}  You are now ${r.player.name}, ${r.player.age.toFixed(0)}y ${r.player.occupation}.`, 'success');
  }

  async study() { this.game.advanceTurns(180); this._emit(`${G.book}  You study.`, 'info'); }
  async craft() { this.game.advanceTurns(180); this._emit(`${G.iron}  You craft.`, 'info'); }
  async cook() { this.game.advanceTurns(60); this._emit(`${G.fire}  You cook.`, 'info'); }
  async hunt() { this.game.advanceTurns(180); this._emit(`${G.bow}  You hunt.`, 'info'); }
  async forage() { this.game.advanceTurns(120); this._emit(`${G.flower}  You forage.`, 'info'); }
  async pray() { this.game.advanceTurns(20); this._emit(`${G.cross}  You pray.`, 'info'); }

  async save() {
    try {
      const data = this.game.save();
      const fs = await import('fs');
      const path = await import('path');
      const dir = './saves';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const player = this.game.player;
      const fname = `save_${player?.name || 'anon'}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const full = path.join(dir, fname);
      fs.writeFileSync(full, JSON.stringify(data, null, 2));
      try { Game.pruneOldSaves(dir, 5); } catch (_) {}
      this._emit(`${G.book}  Saved to ${full}`, 'success');
    } catch (e) {
      this._emit(`Save failed: ${e.message}`, 'error');
    }
  }

  async load() {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dir = './saves';
      if (!fs.existsSync(dir)) { this._emit('No saves found.', 'error'); return; }
      const latest = Game.latestSaveFile(dir);
      if (!latest) { this._emit('No saves found.', 'error'); return; }
      const filepath = path.join(dir, latest);
      // T7-Hygiene: refuse oversized or future-schema saves.
      const latestStats = fs.statSync(filepath);
      if (latestStats.size > 50 * 1024 * 1024) {
        this._emit(`Refusing to load ${latest}: size ${(latestStats.size / (1024 * 1024)).toFixed(1)} MB exceeds 50 MB cap.`, 'error');
        return;
      }
      const rawData = fs.readFileSync(filepath, 'utf8');
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (parseErr) {
        this._emit(`Load failed: invalid JSON in ${latest} (${parseErr.message})`, 'error');
        return;
      }
      if (typeof data?.schemaVersion === 'number' && data.schemaVersion > Game.SAVE_SCHEMA_VERSION) {
        this._emit(`Refusing to load ${latest}: schemaVersion=${data.schemaVersion} is newer than supported (${Game.SAVE_SCHEMA_VERSION}).`, 'error');
        return;
      }
      this._emit(`${G.book}  Latest save: ${latest}  (auto-loaded)`, 'info');
      this.game.load(data);
      this._emit(`${G.fleur}  Loaded.`, 'success');
    } catch (e) {
      this._emit(`Load failed: ${e.message}`, 'error');
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  _nearbyItems() {
    const p = this.game.player;
    const settlement = p?.position?.settlementId != null
      ? this.game.world?.settlements?.[p.position.settlementId]
      : null;
    return settlement?.items || [];
  }

  // Run a named command (slash or alias). Returns Promise.
  async run(name, args) {
    const fn = this[name];
    if (!fn) { this._emit(`Unknown command: ${name}. Type ${G.swashOpen}help${G.swashClose}.`, 'error'); return; }
    try {
      await fn.call(this, args || []);
    } catch (e) {
      this._emit(`Error: ${e.message}`, 'error');
    }
  }
}