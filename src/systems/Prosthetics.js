/**
 * Prosthetics.js
 *
 * Medieval prosthetic-limb replacement system. C:DDA's "bionics" reimagined
 * for the early-modern toolkit: peg legs, hook hands, iron arms, glass eyes,
 * false noses, and saint-blessed relics.
 *
 * Per the locked roadmap:
 * - Fitting is MANUAL (no auto-fitting). Caller invokes fitProsthetic
 *   explicitly with chosen (person, type, craftsman, slot).
 * - Requires a craftsman with the matching trade at the settlement, plus a
 *   Medicine skill check on the installer.
 * - Replacement limbs are PARTIAL: a peg leg is slower than a real leg, a
 *   hook hand has a grip penalty, etc. Only saint-blessed relics grant
 *   supernatural bonuses (miracle tier: minor regen, curse ward).
 * - Recovery time decays each turn via update(); the prosthetic becomes
 *   functional once recovery completes.
 *
 * ES modules; uses kernel.rng + kernel.turn only (no Math.random/Date.now).
 * Throttles update() to once per 60 turns (one game-hour) by default.
 */

export const PROSTHETIC_CATALOG = {
  peg_leg: {
    id: 'peg_leg',
    name: 'Peg Leg',
    slot: 'leg',
    craftsman: 'carpenter',
    material: 'wood',
    fitHours: 24,
    recoveryHours: 72,
    functionality: 0.45,
    abilities: { walk: 0.6, run: 0.0, swim: 0.1 },
    relic: false
  },
  hook_hand: {
    id: 'hook_hand',
    name: 'Hook Hand',
    slot: 'hand',
    craftsman: 'blacksmith',
    material: 'iron',
    fitHours: 12,
    recoveryHours: 48,
    functionality: 0.55,
    abilities: { grip: 0.5, fine_motor: 0.05, climb: 0.2 },
    relic: false
  },
  iron_hand: {
    id: 'iron_hand',
    name: 'Iron Hand',
    slot: 'hand',
    craftsman: 'blacksmith',
    material: 'iron',
    fitHours: 30,
    recoveryHours: 96,
    functionality: 0.7,
    abilities: { grip: 0.85, fine_motor: 0.2, climb: 0.4 },
    relic: false
  },
  wooden_hand: {
    id: 'wooden_hand',
    name: 'Wooden Hand',
    slot: 'hand',
    craftsman: 'carpenter',
    material: 'wood',
    fitHours: 8,
    recoveryHours: 36,
    functionality: 0.5,
    abilities: { grip: 0.4, fine_motor: 0.35, climb: 0.3 },
    relic: false
  },
  false_nose: {
    id: 'false_nose',
    name: 'False Nose',
    slot: 'nose',
    craftsman: 'silversmith',
    material: 'silver',
    fitHours: 4,
    recoveryHours: 24,
    functionality: 0.8,
    abilities: { smell: 0.85, social: 0.9 },
    relic: false
  },
  glass_eye: {
    id: 'glass_eye',
    name: 'Glass Eye',
    slot: 'eye',
    craftsman: 'silversmith',
    material: 'glass',
    fitHours: 6,
    recoveryHours: 24,
    functionality: 0.75,
    abilities: { sight: 0.8, depth_perception: 0.6 },
    relic: false
  },
  iron_arm: {
    id: 'iron_arm',
    name: 'Iron Arm',
    slot: 'arm',
    craftsman: 'blacksmith',
    material: 'iron',
    fitHours: 60,
    recoveryHours: 168,
    functionality: 0.6,
    abilities: { grip: 0.9, lift: 1.2, fine_motor: 0.15 },
    relic: false
  },
  saints_relic_hand: {
    id: 'saints_relic_hand',
    name: "Saint's Blessed Relic (Hand)",
    slot: 'hand',
    craftsman: 'clergy',
    material: 'relic',
    fitHours: 12,
    recoveryHours: 48,
    functionality: 0.9,
    abilities: { grip: 0.8, fine_motor: 0.7, heal: 0.1 },
    relic: true,
    boons: { hpRegenPerTurn: 1, curseWard: true }
  }
};

const ALL_PROSTHETIC_IDS = Object.keys(PROSTHETIC_CATALOG);

export class Prosthetics {
  /**
   * @param {object} kernel - SimulationKernel
   * @param {object} [game=null] - orchestrator (optional)
   */
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    /** personId -> Map<slot, prostheticId> */
    this.installed = new Map();
    /** personId -> Map<prostheticId, { fittedAt, recoveryEndsAt, status, craftsmanId}> */
    this.fitRecords = new Map();
    /** personId -> Map<prostheticId, active boons snapshot> */
    this.activeBoons = new Map();
    this.nextRecordId = 1;
    this._lastUpdateTurn = -Infinity;
  }

  _personMap(id) {
    if (!this.installed.has(id)) this.installed.set(id, new Map());
    if (!this.fitRecords.has(id)) this.fitRecords.set(id, new Map());
    if (!this.activeBoons.has(id)) this.activeBoons.set(id, new Map());
  }

  /**
   * List all prosthetic types in the catalog.
   * @returns {object[]}
   */
  getCatalog() {
    return Object.values(PROSTHETIC_CATALOG).map((p) => ({ ...p }));
  }

  /**
   * Return installed prosthetic for a person/slot, or null.
   * @param {object} person
   * @param {string} slot
   */
  getProsthetic(person, slot) {
    if (!person || person.id == null) return null;
    const slots = this.installed.get(person.id);
    if (!slots) return null;
    const pid = slots.get(slot);
    if (!pid) return null;
    const rec = this.fitRecords.get(person.id)?.get(pid);
    return rec ? { prostheticId: pid, ...rec } : null;
  }

  /**
   * Turns remaining in recovery for the prosthetic at a given slot.
   * Returns 0 if already functional or none installed.
   * @param {object} person
   * @param {string} [slot=null] optional - if omitted, max across slots
   */
  getRecoveryTime(person, slot = null) {
    if (!person || person.id == null) return 0;
    const slots = this.installed.get(person.id);
    if (!slots) return 0;
    const recs = this.fitRecords.get(person.id);
    if (!recs) return 0;
    const targets = slot ? [slots.get(slot)].filter(Boolean) : [...slots.values()];
    let max = 0;
    const t = this.kernel.turn;
    for (const pid of targets) {
      const r = recs.get(pid);
      if (!r) continue;
      const remaining = r.recoveryEndsAt - t;
      if (remaining > max) max = remaining;
    }
    return Math.max(0, max);
  }

  /**
   * Verify the given craftsman has the trade this prosthetic needs.
   * @returns {boolean}
   */
  _craftsmanCanFit(craftsman, prostheticType) {
    if (!craftsman) return false;
    if (craftsman.dead || craftsman.health <= 0) return false;
    if (craftsman.occupation === prostheticType.craftsman) return true;
    if (prostheticType.craftsman === 'clergy' && craftsman.occupation === 'priest') return true;
    if (craftsman.skills?.crafting?.[prostheticType.craftsman]) return true;
    return false;
  }

  /**
   * Medicine check on the installer. Returns 0..1 score.
   */
  _medicineCheck(installer) {
    const skill = installer?.skills?.medical?.surgery?.level
      ?? installer?.skills?.medical?.surgery
      ?? installer?.skills?.mental?.knowledge?.level
      ?? 0;
    const noise = this.kernel.rng.next();
    return Math.min(1, Math.max(0, 0.4 + skill * 0.15 + noise * 0.45));
  }

  /**
   * Manually fit a prosthetic. Per roadmap: NO auto-fitting.
   *
   * @param {object} person recipient
   * @param {string} prostheticTypeId id from PROSTHETIC_CATALOG
   * @param {object} craftsman tradesperson (carpenter/blacksmith/silversmith/priest)
   * @param {string} slot body slot (must match the prosthetic's slot field)
   */
  fitProsthetic(person, prostheticTypeId, craftsman, slot) {
    if (!person || person.id == null) {
      return { success: false, prostheticId: null, message: 'No recipient' };
    }
    if (person.dead || person.health <= 0) {
      return { success: false, prostheticId: null, message: 'Recipient is dead or incapacitated' };
    }
    const tdef = PROSTHETIC_CATALOG[prostheticTypeId];
    if (!tdef) return { success: false, prostheticId: null, message: `Unknown prosthetic: ${prostheticTypeId}` };
    if (tdef.slot !== slot) {
      return { success: false, prostheticId: null, message: `Slot mismatch: ${tdef.slot} expected, got ${slot}` };
    }
    if (!this._craftsmanCanFit(craftsman, tdef)) {
      return { success: false, prostheticId: null, message: `No ${tdef.craftsman} available` };
    }
    this._personMap(person.id);
    const slots = this.installed.get(person.id);
    if (slots.has(slot)) {
      return { success: false, prostheticId: null, message: `Slot ${slot} already occupied` };
    }
    const medicineScore = this._medicineCheck(craftsman);
    const recordId = this.nextRecordId++;
    const fittedAt = this.kernel.turn;
    const recoveryEndsAt = fittedAt + tdef.recoveryHours; // 60 turns/hour
    const rec = {
      recordId,
      slot,
      prostheticId: tdef.id,
      fittedAt,
      recoveryEndsAt,
      status: 'recovering',
      craftsmanId: craftsman.id ?? null,
      medicineScore,
      boons: tdef.relic ? { ...tdef.boons } : null
    };
    this.fitRecords.get(person.id).set(tdef.id, rec);
    slots.set(slot, tdef.id);
    if (rec.boons) this.activeBoons.get(person.id).set(tdef.id, rec.boons);
    return {
      success: true,
      prostheticId: tdef.id,
      message: tdef.relic
        ? `Miracle-tier relic ${tdef.name} fitted; recovery ${tdef.recoveryHours / 60}h`
        : `${tdef.name} fitted to ${slot}; recovery ${tdef.recoveryHours / 60}h`
    };
  }

  /**
   * Remove a prosthetic. Returns success boolean.
   * @param {object} person
   * @param {string} slot
   */
  removeProsthetic(person, slot) {
    if (!person || person.id == null) return { success: false };
    const slots = this.installed.get(person.id);
    if (!slots) return { success: false };
    const pid = slots.get(slot);
    if (!pid) return { success: false };
    slots.delete(slot);
    this.fitRecords.get(person.id)?.delete(pid);
    this.activeBoons.get(person.id)?.delete(pid);
    return { success: true };
  }

  /**
   * Per-turn recovery tick. Throttled to once per game-hour (60 turns).
   * Promotes recovering prosthetics to 'functional' when their
   * recoveryEndsAt threshold passes.
   */
  update(kernel) {
    const t = kernel.turn;
    if (t - this._lastUpdateTurn < 60) return;
    this._lastUpdateTurn = t;
    for (const [pid, recs] of this.fitRecords.entries()) {
      for (const rec of recs.values()) {
        if (rec.status === 'recovering' && t >= rec.recoveryEndsAt) {
          rec.status = 'functional';
        }
      }
    }
  }

  /**
   * Serialize for save files.
   */
  toJSON() {
    const out = { installed: {}, fitRecords: {}, activeBoons: {}, nextRecordId: this.nextRecordId };
    for (const [k, v] of this.installed) out.installed[k] = Object.fromEntries(v);
    for (const [k, v] of this.fitRecords) out.fitRecords[k] = Object.fromEntries(v);
    for (const [k, v] of this.activeBoons) out.activeBoons[k] = Object.fromEntries(v);
    return out;
  }

  fromJSON(data) {
    if (!data) return;
    this.installed = new Map(Object.entries(data.installed || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
    this.fitRecords = new Map(Object.entries(data.fitRecords || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
    this.activeBoons = new Map(Object.entries(data.activeBoons || {}).map(([k, v]) => [k, new Map(Object.entries(v))]));
    this.nextRecordId = data.nextRecordId || 1;
  }
}

export { ALL_PROSTHETIC_IDS };
