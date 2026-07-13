/**
 * Curses.js
 *
 * Curses & Blessings system — medieval replacement for C:DDA mutations.
 *
 * Hybrid mechanic per the locked roadmap:
 *   (a) PASSIVE events strike people based on lifestyle (forest = werewolf
 *       risk, city = curse risk, church = blessing risk), low chance per
 *       in-game hour;
 *   (b) VOLUNTARY ritual paths require a Religion/Occultism/Wilderness skill
 *       tier >= 3 to unlock.
 *
 * Side effects stored as records on the person (stat modifiers, abilities,
 * social stigma). Removal = cure / atonement / exorcism.
 *
 * ES modules; uses kernel.rng + kernel.turn only (no Math.random/Date.now).
 * Throttles update() to once per 60 turns (one game-hour) by default.
 */

export const CURSE_REGISTRY = {
  lycanthropy: {
    id: 'lycanthropy',
    kind: 'curse',
    label: 'Lycanthropy',
    trigger: 'werewolf_bite',
    passiveBaseChance: 0.00005,
    lifestyleAffinity: { forest: 0.03, swamp: 0.04, rural: 0.01 },
    skillGate: null,
    statMods: { strength: 1.4, perception: 1.2, faith: -0.5, fertility: -0.6 },
    abilities: ['night_vision', 'transform_wolf', 'animal_speech'],
    stigma: 0.7,
    rarity: 'rare',
    removeMethod: ['exorcism', 'atonement']
  },
  witches_mark: {
    id: 'witches_mark',
    kind: 'curse',
    label: "Witch's Mark",
    trigger: 'witches_pact',
    passiveBaseChance: 0.00008,
    lifestyleAffinity: { city: 0.02, town: 0.015, rural: 0.005 },
    skillGate: { path: 'occultism', tier: 3 },
    statMods: { faith: -1.0, perception: 1.3, fertility: -0.3 },
    abilities: ['hex_speech', 'familiar', 'detect_pious'],
    stigma: 0.85,
    rarity: 'uncommon',
    removeMethod: ['exorcism', 'atonement']
  },
  fairy_blood: {
    id: 'fairy_blood',
    kind: 'curse',
    label: 'Fairy Blood',
    trigger: 'changeling_swap',
    passiveBaseChance: 0.00004,
    lifestyleAffinity: { forest: 0.02, swamp: 0.015, rural: 0.008 },
    skillGate: null,
    statMods: { perception: 1.4, fertility: -0.9, faith: -0.3, charm: 1.6 },
    abilities: ['unearthly_grace', 'cold_iron_sensitive', 'glamour'],
    stigma: 0.45,
    rarity: 'rare',
    removeMethod: ['exorcism', 'atonement']
  },
  vampirism: {
    id: 'vampirism',
    kind: 'curse',
    label: 'Vampirism',
    trigger: 'vampire_bite',
    passiveBaseChance: 0.00001,
    lifestyleAffinity: { graveyard: 0.05, city: 0.005, rural: 0.002 },
    skillGate: null,
    statMods: { strength: 1.6, perception: 1.5, fertility: -1.0, faith: -1.5 },
    abilities: ['night_vision', 'blood_drain', 'hypnotic_gaze', 'no_shadow'],
    stigma: 0.95,
    rarity: 'legendary',
    removeMethod: ['exorcism', 'atonement']
  },
  divine_curse: {
    id: 'divine_curse',
    kind: 'curse',
    label: 'Divine Curse',
    trigger: 'sacrilege',
    passiveBaseChance: 0.00003,
    lifestyleAffinity: { church: 0.04, temple: 0.03 },
    skillGate: null,
    statMods: { faith: -2.0, fertility: -0.7, luck: -0.5 },
    abilities: ['sacrilege_taint', 'omen_sense'],
    stigma: 0.55,
    rarity: 'rare',
    removeMethod: ['atonement']
  },
  pestilence_touch: {
    id: 'pestilence_touch',
    kind: 'curse',
    label: 'Pestilence Touch',
    trigger: 'plague_saint_curse',
    passiveBaseChance: 0.00006,
    lifestyleAffinity: { city: 0.02, slum: 0.05, village: 0.01 },
    skillGate: null,
    statMods: { health: -0.4, faith: 0.3 },
    abilities: ['plague_carrier', 'fever_aura'],
    stigma: 0.6,
    rarity: 'uncommon',
    removeMethod: ['exorcism']
  }
};

export const BLESSING_REGISTRY = {
  saints_favor: {
    id: 'saints_favor',
    kind: 'blessing',
    label: "Saint's Favor",
    trigger: 'pilgrimage',
    passiveBaseChance: 0.0001,
    lifestyleAffinity: { church: 0.05, temple: 0.04, monastery: 0.06 },
    skillGate: { path: 'religion', tier: 3 },
    statMods: { faith: 1.6, luck: 0.4, fertility: 0.2 },
    abilities: ['minor_miracle', 'curse_ward', 'pilgrim_blessed'],
    stigma: 0,
    rarity: 'common',
    removeMethod: ['severance']
  },
  divine_oracle: {
    id: 'divine_oracle',
    kind: 'blessing',
    label: 'Divine Oracle',
    trigger: 'visions',
    passiveBaseChance: 0.00004,
    lifestyleAffinity: { monastery: 0.04, hermitage: 0.06 },
    skillGate: { path: 'religion', tier: 3 },
    statMods: { perception: 1.7, faith: 1.0, luck: 0.2 },
    abilities: ['visions', 'prophecy_fragment', 'detect_lies'],
    stigma: 0,
    rarity: 'uncommon',
    removeMethod: ['severance']
  },
  sacred_vow: {
    id: 'sacred_vow',
    kind: 'blessing',
    label: 'Sacred Vow',
    trigger: 'oath_bound',
    passiveBaseChance: 0.00003,
    lifestyleAffinity: { church: 0.02, military: 0.01 },
    skillGate: { path: 'religion', tier: 3 },
    statMods: { faith: 1.2, strength: 0.3, fertility: -0.4 },
    abilities: ['oath_strength', 'temptation_resist'],
    stigma: 0,
    rarity: 'uncommon',
    removeMethod: ['severance']
  },
  blessed_touch: {
    id: 'blessed_touch',
    kind: 'blessing',
    label: 'Blessed Touch',
    trigger: 'healers_hands',
    passiveBaseChance: 0.00005,
    lifestyleAffinity: { church: 0.03, monastery: 0.04, hospital: 0.05 },
    skillGate: { path: 'religion', tier: 3 },
    statMods: { faith: 1.4, perception: 0.3 },
    abilities: ['lay_on_hands', 'cleanse_minor_ailment'],
    stigma: 0,
    rarity: 'common',
    removeMethod: ['severance']
  },
  woodland_kinship: {
    id: 'woodland_kinship',
    kind: 'blessing',
    label: 'Woodland Kinship',
    trigger: 'dryad_pact',
    passiveBaseChance: 0.00002,
    lifestyleAffinity: { forest: 0.04, grove: 0.06 },
    skillGate: { path: 'wilderness', tier: 3 },
    statMods: { perception: 1.3, fertility: 0.6, faith: -0.2, charm: 1.0 },
    abilities: ['speak_with_trees', 'forest_walk', 'thornbinding'],
    stigma: 0,
    rarity: 'rare',
    removeMethod: ['severance']
  }
};

const ALL_CURSES = Object.values(CURSE_REGISTRY);
const ALL_BLESSINGS = Object.values(BLESSING_REGISTRY);
const ALL_EFFECTS = [...ALL_CURSES, ...ALL_BLESSINGS];

const EVENT_TO_EFFECT = new Map();
for (const e of ALL_EFFECTS) EVENT_TO_EFFECT.set(e.trigger, e);

const SKILL_PATH_TO_LEVEL = {
  religion: (p) => p?.skills?.mental?.faith?.level ?? p?.skills?.social?.religion?.level ?? 0,
  occultism: (p) => p?.skills?.mental?.knowledge?.level ?? p?.skills?.arcane?.occultism?.level ?? 0,
  wilderness: (p) => p?.skills?.survival?.foraging?.level ?? p?.skills?.survival?.hunting?.level ?? 0
};

function tierFromLevel(level) {
  if (level >= 8) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  if (level >= 1) return 1;
  return 0;
}

function personLocation(person, game) {
  if (game?.world?.biomeAt) {
    try { return game.world.biomeAt(person.location?.x ?? 0, person.location?.y ?? 0); } catch (e) {}
  }
  return person.location?.biome || person.biome || 'rural';
}

export class Curses {
  /**
   * @param {object} kernel - SimulationKernel
   * @param {object} [game=null] - orchestrator (optional)
   * @param {object} [opts]
   */
  constructor(kernel, game = null, opts = {}) {
    this.kernel = kernel;
    this.game = game;
    /** personId -> Map<effectId, effectRecord> */
    this.active = new Map();
    this.nextEffectId = 1;
    this._lastUpdateTurn = -Infinity;
    this.opts = {
      passiveProbabilityScale: 1.0,
      ...opts
    };
  }

  _personMap(id) {
    if (!this.active.has(id)) this.active.set(id, new Map());
  }

  /** @returns {object[]} */
  getCurses() { return ALL_CURSES.map((c) => ({ ...c })); }

  /** @returns {object[]} */
  getBlessings() { return ALL_BLESSINGS.map((b) => ({ ...b })); }

  /** @returns {object[]} active effects for a person (deep-copied). */
  getEffects(person) {
    if (!person || person.id == null) return [];
    const m = this.active.get(person.id);
    if (!m) return [];
    return [...m.values()].map((r) => ({ ...r }));
  }

  /**
   * Did the person meet the skill gate for this effect?
   */
  _skillGateMet(person, def) {
    if (!def.skillGate) return true;
    const fn = SKILL_PATH_TO_LEVEL[def.skillGate.path];
    if (!fn) return false;
    const lvl = fn(person);
    return tierFromLevel(lvl) >= def.skillGate.tier;
  }

  /**
   * Force-trigger an event on a person.
   *
   * @param {object} person
   * @param {string} eventType - trigger key from any registry entry
   */
  triggerEvent(person, eventType) {
    if (!person || person.id == null) {
      return { success: false, effectId: null, message: 'No recipient' };
    }
    const def = EVENT_TO_EFFECT.get(eventType);
    if (!def) return { success: false, effectId: null, message: `Unknown event: ${eventType}` };
    this._personMap(person.id);
    if (this.active.get(person.id).has(def.id)) {
      return { success: false, effectId: null, message: `Already afflicted with ${def.label}` };
    }
    const effectId = this.nextEffectId++;
    const rec = {
      effectId,
      personId: person.id,
      defId: def.id,
      label: def.label,
      kind: def.kind,
      trigger: def.trigger,
      statMods: { ...def.statMods },
      abilities: [...def.abilities],
      stigma: def.stigma,
      rarity: def.rarity,
      appliedAt: this.kernel.turn,
      removeMethod: [...def.removeMethod]
    };
    this.active.get(person.id).set(def.id, rec);
    return { success: true, effectId: def.kind === 'curse' ? effectId : effectId, curseId: def.kind === 'curse' ? effectId : null, blessingId: def.kind === 'blessing' ? effectId : null, label: def.label };
  }

  /**
   * Attempt a voluntary ritual. Skill tier gating applies; rolls once.
   *
   * @param {object} person
   * @param {'curse'|'blessing'} ritual
   * @param {string} type id from the matching registry
   */
  attemptRitual(person, ritual, type) {
    if (!person || person.id == null) {
      return { success: false, effect: null, message: 'No candidate' };
    }
    const pool = ritual === 'curse' ? CURSE_REGISTRY : BLESSING_REGISTRY;
    const def = pool[type];
    if (!def) return { success: false, effect: null, message: `Unknown ${ritual}: ${type}` };
    if (!this._skillGateMet(person, def)) {
      return { success: false, effect: null, message: `Requires ${def.skillGate.path} tier ${def.skillGate.tier}` };
    }
    const roll = this.kernel.rng.next();
    const success = roll < 0.5;
    if (!success) return { success, effect: null, message: `Ritual failed (roll ${roll.toFixed(2)})` };
    const trig = def.trigger;
    return { ...this.triggerEvent(person, trig), effect: def };
  }

  /**
   * Remove an effect by id.
   *
   * @param {object} person
   * @param {string|number} effectId - either numeric EffectId or a registry id string.
   * @param {string} method - 'exorcism' | 'atonement' | 'severance' | 'auto'
   */
  removeEffect(person, effectId, method = 'auto') {
    if (!person || person.id == null) return { success: false };
    const m = this.active.get(person.id);
    if (!m) return { success: false };
    let target = null;
    if (typeof effectId === 'number') {
      for (const rec of m.values()) if (rec.effectId === effectId) { target = rec; break; }
    } else {
      target = m.get(effectId) || null;
    }
    if (!target) return { success: false };
    if (method !== 'auto' && !target.removeMethod.includes(method)) {
      return { success: false, message: `${method} cannot lift ${target.label}` };
    }
    m.delete(target.defId);
    return { success: true, removed: target.label };
  }

  /**
   * Passive per-hour exposure check for the player (or first found person).
   * Lifestyle affinity scales the base chance.
   */
  _passiveTickForPerson(person) {
    const biome = personLocation(person, this.game);
    const all = ALL_EFFECTS;
    for (const def of all) {
      if (this.active.get(person.id)?.has(def.id)) continue;
      const base = def.passiveBaseChance * (this.opts.passiveProbabilityScale ?? 1);
      const affinity = def.lifestyleAffinity?.[biome] ?? 0;
      const chance = base * (1 + affinity);
      if (this.kernel.rng.next() < chance) {
        this.triggerEvent(person, def.trigger);
      }
    }
  }

  /**
   * Throttled per-hour update. Walks the entity map and ticks passive
   * exposure for a small random sample to stay O(N) light.
   */
  update(kernel) {
    const t = kernel.turn;
    if (t - this._lastUpdateTurn < 60) return;
    this._lastUpdateTurn = t;
    if (!this.game?.kernel?.entities) return;
    const ents = this.game.kernel.entities;
    let sampled = 0;
    for (const ent of ents.values()) {
      if (!ent || ent.dead || sampled >= 5) continue;
      // Cheap: only sample a handful per tick.
      this._passiveTickForPerson(ent);
      sampled++;
    }
  }

  toJSON() {
    const out = { active: {}, nextEffectId: this.nextEffectId };
    for (const [k, v] of this.active) out.active[k] = Object.fromEntries(v);
    return out;
  }

  fromJSON(data) {
    if (!data) return;
    this.active = new Map(Object.entries(data.active || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
    this.nextEffectId = data.nextEffectId || 1;
  }
}

export { SKILL_PATH_TO_LEVEL, tierFromLevel };
