/**
 * RangedCombat.js — medieval ranged combat: bows, crossbows, thrown, slings.
 * Strict medieval: no gunpowder. Deterministic from kernel.rng.
 *
 * Integration:
 *   const rc = new RangedCombat(kernel, game);
 *   rc.update(kernel);                              // per turn
 *   rc.attack(attacker, defender, weapon, ammo, opts);
 *
 * attack() returns:
 *   { success, hit, damage, location, cause, ammoConsumed, reason? }
 *   reason is set iff success === false (e.g. 'no_ammo', 'out_of_range').
 */

const TURNS_PER_HOUR = 60;
const MAX_AIM_TURNS = 6;        // cap on aimTurns that actually contribute

/** Read-only weapon catalog. Frozen so callers can't tweak stats. */
const WEAPON_CATALOG = Object.freeze([
  // Bows
  { id: 'longbow',       name: 'Longbow',       category: 'bow',      damage: 18, range: 220, reloadTime: 1, ammoType: 'arrow',       drawWeight: 0.95, armorPenetration: 0.25, ignoresArmor: false },
  { id: 'shortbow',      name: 'Shortbow',      category: 'bow',      damage: 12, range: 130, reloadTime: 1, ammoType: 'arrow',       drawWeight: 0.60, armorPenetration: 0.18, ignoresArmor: false },
  { id: 'hunting_bow',   name: 'Hunting Bow',   category: 'bow',      damage: 14, range: 170, reloadTime: 1, ammoType: 'arrow',       drawWeight: 0.75, armorPenetration: 0.20, ignoresArmor: false },
  { id: 'composite_bow', name: 'Composite Bow', category: 'bow',      damage: 16, range: 200, reloadTime: 1, ammoType: 'arrow',       drawWeight: 0.85, armorPenetration: 0.22, ignoresArmor: false },
  // Crossbows
  { id: 'light_crossbow', name: 'Light Crossbow', category: 'crossbow', damage: 22, range: 180, reloadTime: 3, ammoType: 'bolt', drawWeight: 0.70, armorPenetration: 0.55, ignoresArmor: false },
  { id: 'heavy_crossbow', name: 'Heavy Crossbow', category: 'crossbow', damage: 32, range: 220, reloadTime: 5, ammoType: 'bolt', drawWeight: 0.90, armorPenetration: 0.75, ignoresArmor: false },
  { id: 'arbalest',       name: 'Arbalest',       category: 'crossbow', damage: 40, range: 260, reloadTime: 7, ammoType: 'bolt', drawWeight: 1.00, armorPenetration: 0.85, ignoresArmor: false },
  { id: 'hand_crossbow',  name: 'Hand Crossbow',  category: 'crossbow', damage: 10, range:  60, reloadTime: 2, ammoType: 'bolt', drawWeight: 0.40, armorPenetration: 0.35, ignoresArmor: false },
  // Thrown
  { id: 'javelin',      name: 'Javelin',      category: 'thrown', damage: 20, range:  50, reloadTime: 2, ammoType: 'javelin',     drawWeight: 0.70, armorPenetration: 0.30, ignoresArmor: false },
  { id: 'atlatl_dart',  name: 'Atlatl Dart',  category: 'thrown', damage: 16, range:  40, reloadTime: 1, ammoType: 'dart',         drawWeight: 0.60, armorPenetration: 0.25, ignoresArmor: false },
  { id: 'throwing_axe', name: 'Throwing Axe', category: 'thrown', damage: 14, range:  30, reloadTime: 1, ammoType: 'throwing_axe', drawWeight: 0.55, armorPenetration: 0.20, ignoresArmor: false },
  // Sling
  { id: 'sling',       name: 'Sling',       category: 'sling', damage: 6, range: 200, reloadTime: 1, ammoType: 'sling_stone', drawWeight: 0.50, armorPenetration: 0.05, ignoresArmor: true },
  { id: 'sling_staff', name: 'Sling Staff', category: 'sling', damage: 8, range: 240, reloadTime: 1, ammoType: 'sling_stone', drawWeight: 0.60, armorPenetration: 0.08, ignoresArmor: true }
].map(Object.freeze));

const WEAPON_INDEX = Object.freeze(WEAPON_CATALOG.reduce((a, w) => (a[w.id] = w, a), {}));

/** Arrowhead material — multiplies bow damage and armor penetration. */
const ARROW_MATERIAL = Object.freeze({
  wood:  Object.freeze({ damageMult: 0.70, penMult: 0.80 }),
  bone:  Object.freeze({ damageMult: 0.75, penMult: 0.85 }),
  flint: Object.freeze({ damageMult: 0.85, penMult: 0.95 }),
  iron:  Object.freeze({ damageMult: 1.00, penMult: 1.10 }),
  steel: Object.freeze({ damageMult: 1.15, penMult: 1.25 })
});
const DEFAULT_AMMO_MATERIAL = 'iron';

/** Range bands with accuracy multipliers; entries ordered by ascending distance. */
const RANGE_BANDS = Object.freeze([
  { id: 'point_blank', max: 10,     accuracyMult: 1.15 },
  { id: 'short',       max: 50,     accuracyMult: 1.00 },
  { id: 'medium',      max: 120,    accuracyMult: 0.85 },
  { id: 'long',        max: 200,    accuracyMult: 0.55 },
  { id: 'extreme',     max: Infinity, accuracyMult: 0.25 }
]);

const HIT_LOCATIONS = Object.freeze([
  { id: 'head',  weight: 0.10, severityMult: 1.6 },
  { id: 'torso', weight: 0.50, severityMult: 1.0 },
  { id: 'arm',   weight: 0.20, severityMult: 0.7 },
  { id: 'leg',   weight: 0.20, severityMult: 0.8 }
]);

const COVER_ACCURACY_PENALTY = Object.freeze({
  none:   0.00,
  light:  0.20,
  medium: 0.35,
  heavy:  0.55
});

export class RangedCombat {
  constructor(kernel, game) {
    this.kernel = kernel;
    this.game = game;
    this.lastUpdateTurn = -Infinity;
  }

  /** Per-tick hook. Throttled to once per game-hour; reserved for scheduled reloads, aim decay, wet-string checks. */
  update(kernel) {
    if (kernel.turn - this.lastUpdateTurn < TURNS_PER_HOUR) return;
    this.lastUpdateTurn = kernel.turn;
  }

  /**
   * Resolve a single ranged attack.
   * @param {object} attacker   Person entity
   * @param {object} defender   Person entity
   * @param {object|string} weapon  Weapon entry or catalog id
   * @param {object|null} ammo  { material } for arrows; null for thrown
   * @param {object} [opts]     { distance, cover, aimTurns }
   */
  attack(attacker, defender, weapon, ammo, opts = {}) {
    const kernel = this.kernel;
    if (!attacker || !defender) return this._fail('missing_attacker_or_defender');
    if (attacker.alive === false || defender.alive === false) return this._fail('target_or_attacker_dead');

    const weaponDef = this._resolveWeapon(weapon);
    if (!weaponDef) return this._fail('unknown_weapon');

    if (weaponDef.category !== 'thrown' && !this.hasAmmo(attacker, weaponDef, 1)) {
      return this._fail('no_ammo');
    }

    const distance = this._resolveDistance(attacker, defender, opts);
    if (distance > weaponDef.range) return this._fail('out_of_range');

    const cover = opts.cover || 'none';
    const aimTurns = Math.max(0, Math.min(MAX_AIM_TURNS, opts.aimTurns || 0));
    const accuracy = this.calculateAccuracy(attacker, defender, weaponDef, distance, { cover, aimTurns });

    if (kernel.rng.next() > accuracy) {
      this._decrementAmmo(attacker, weaponDef.ammoType, 1);
      return { success: true, hit: false, damage: 0, location: 'miss', cause: `${weaponDef.name} miss`, ammoConsumed: true };
    }

    const location = this._rollLocation(kernel);
    const ammoMaterial = this._resolveAmmoMaterial(ammo);
    const damage = this._calculateDamage(attacker, defender, weaponDef, ammoMaterial, location);
    this._decrementAmmo(attacker, weaponDef.ammoType, 1);
    this._applyDamage(defender, damage, location);

    return { success: true, hit: true, damage, location, cause: `${weaponDef.name} wound to ${location}`, ammoConsumed: true };
  }

  /**
   * Compute hit probability in [0, 1].
   *   (baseSkill + aimBonus - coverPenalty) * rangeMult * fatigueMult
   * baseSkill  = 0.5 + (attackerRanged - defenderDefense) * 0.35
   * aimBonus   = aimTurns * 0.06 (capped by MAX_AIM_TURNS)
   * rangeMult  = from RANGE_BANDS for the given distance
   */
  calculateAccuracy(attacker, defender, weapon, distance, opts = {}) {
    const weaponDef = this._resolveWeapon(weapon);
    if (!weaponDef) return 0;
    const attackerSkill = this._getSkill(attacker, 'ranged') ?? 0.4;
    const defenderSkill = this._getSkill(defender, 'defense') ?? 0.3;
    const baseSkill = 0.5 + (attackerSkill - defenderSkill) * 0.35;
    const aimTurns = Math.max(0, Math.min(MAX_AIM_TURNS, opts.aimTurns || 0));
    const aimBonus = aimTurns * 0.06;
    const coverPenalty = COVER_ACCURACY_PENALTY[opts.cover || 'none'] ?? 0;
    const rangeMult = this._rangeBand(distance).accuracyMult;
    const fatigue = this._fatigueFactor(attacker);
    return Math.min(0.98, Math.max(0.02, (baseSkill + aimBonus - coverPenalty) * rangeMult * fatigue));
  }

  /** Reload time in turns for the given weapon. */
  getReloadTime(weapon) {
    const w = this._resolveWeapon(weapon);
    return w ? w.reloadTime : 0;
  }

  /** Does person have at least `count` ammo of the right type? */
  hasAmmo(person, weapon, count = 1) {
    const w = this._resolveWeapon(weapon);
    return !!w && this._countAmmo(person, w.ammoType) >= count;
  }

  /** Consume ammo. Returns new count on success, false if insufficient. */
  consumeAmmo(person, weapon, count = 1) {
    const w = this._resolveWeapon(weapon);
    if (!w || !this.hasAmmo(person, w, count)) return false;
    this._decrementAmmo(person, w.ammoType, count);
    return this._countAmmo(person, w.ammoType);
  }

  /** Read-only view of the full weapon catalog (shallow copy). */
  getWeapons() { return WEAPON_CATALOG.slice(); }

  /** Look up a single weapon by id. Returns null if unknown. */
  getWeapon(id) { return WEAPON_INDEX[id] || null; }

  // ─── internals ─────────────────────────────────────────────────────────

  _resolveWeapon(weapon) {
    if (!weapon) return null;
    if (typeof weapon === 'string') return WEAPON_INDEX[weapon] || null;
    if (weapon.id && WEAPON_INDEX[weapon.id]) return WEAPON_INDEX[weapon.id];
    return WEAPON_INDEX[weapon.subtype] || WEAPON_INDEX[weapon.type] || null;
  }

  _resolveDistance(attacker, defender, opts) {
    if (typeof opts.distance === 'number') return Math.max(0, opts.distance);
    if (attacker.position && defender.position) {
      const dx = (attacker.position.x || 0) - (defender.position.x || 0);
      const dy = (attacker.position.y || 0) - (defender.position.y || 0);
      return Math.sqrt(dx * dx + dy * dy);
    }
    return 20;
  }

  _rangeBand(distance) {
    for (const band of RANGE_BANDS) if (distance <= band.max) return band;
    return RANGE_BANDS[RANGE_BANDS.length - 1];
  }

  _rollLocation(kernel) {
    const r = kernel.rng.next();
    let acc = 0;
    for (const loc of HIT_LOCATIONS) { acc += loc.weight; if (r <= acc) return loc.id; }
    return HIT_LOCATIONS[HIT_LOCATIONS.length - 1].id;
  }

  _resolveAmmoMaterial(ammo) {
    const mat = (ammo && (ammo.material || ammo.subtype)) || DEFAULT_AMMO_MATERIAL;
    return ARROW_MATERIAL[mat] || ARROW_MATERIAL[DEFAULT_AMMO_MATERIAL];
  }

  /**
   * Damage formula per category:
   *   bow:      base * drawWeight * ammoMat.damageMult
   *   crossbow: base * (1 + (pen - 0.5) * 0.4)         // flat, pen-modulated
   *   thrown:   base * (0.7 + strength * 0.6)
   *   sling:    base * (0.8 + strength * 0.4)           // ignores armor
   * Then × location severity, reduced by armor unless ignoresArmor.
   */
  _calculateDamage(attacker, defender, weapon, ammoMaterial, location) {
    const locMult = HIT_LOCATIONS.find(l => l.id === location)?.severityMult ?? 1.0;
    const strength = this._getStrength(attacker);
    let raw;
    switch (weapon.category) {
      case 'bow':      raw = weapon.damage * weapon.drawWeight * ammoMaterial.damageMult; break;
      case 'crossbow': raw = weapon.damage * (1 + (weapon.armorPenetration - 0.5) * 0.4); break;
      case 'thrown':   raw = weapon.damage * (0.7 + strength * 0.6); break;
      case 'sling':    raw = weapon.damage * (0.8 + strength * 0.4); break;
      default:         raw = weapon.damage;
    }
    if (!weapon.ignoresArmor) {
      const armor = defender.equipment && defender.equipment.armor;
      if (armor) {
        const absorb = Math.max(0, (armor.thickness || 0) * (armor.hardness || 0) - weapon.armorPenetration);
        raw *= Math.max(0.2, 1 - absorb * 0.6);
      }
    }
    return Math.max(0, raw * locMult);
  }

  _applyDamage(defender, damage, location) {
    if (!defender.physiology) return;
    if (typeof defender.physiology.applyInjury === 'function') {
      defender.physiology.applyInjury({
        location, severity: damage,
        bleeding: damage > 5 ? damage * 0.05 : 0,
        open: damage > 8, infected: false, fractured: damage > 18, cause: 'ranged'
      });
    } else if (typeof defender.physiology.takeDamage === 'function') {
      defender.physiology.takeDamage(damage);
    } else if (typeof defender.health === 'number') {
      defender.health = Math.max(0, defender.health - damage);
    }
  }

  _countAmmo(person, ammoType) {
    if (!person || !ammoType) return 0;
    if (person.rangedAmmo && typeof person.rangedAmmo[ammoType] === 'number') return person.rangedAmmo[ammoType];
    if (Array.isArray(person.inventory)) {
      let n = 0;
      for (const item of person.inventory) {
        if (!item) continue;
        if (item.subtype === ammoType || item.type === ammoType) n += (typeof item.count === 'number' ? item.count : 1);
      }
      return n;
    }
    return 999; // built-in fallback so loose callers / tests can resolve
  }

  _decrementAmmo(person, ammoType, count) {
    if (!person || !ammoType) return;
    if (person.rangedAmmo && typeof person.rangedAmmo[ammoType] === 'number') {
      person.rangedAmmo[ammoType] = Math.max(0, person.rangedAmmo[ammoType] - count);
      return;
    }
    if (Array.isArray(person.inventory)) {
      let remaining = count;
      for (let i = person.inventory.length - 1; i >= 0 && remaining > 0; i--) {
        const item = person.inventory[i];
        if (!item) continue;
        if (item.subtype === ammoType || item.type === ammoType) {
          if (typeof item.count === 'number') {
            const take = Math.min(item.count, remaining);
            item.count -= take; remaining -= take;
            if (item.count <= 0) person.inventory.splice(i, 1);
          } else { person.inventory.splice(i, 1); remaining -= 1; }
        }
      }
    }
  }

  _getSkill(person, kind) {
    if (!person?.skills) return null;
    return kind === 'ranged'  ? (person.skills.combat?.ranged   ?? person.skills.ranged   ?? null)
         : kind === 'defense' ? (person.skills.combat?.defense ?? person.skills.defense ?? null)
         : null;
  }

  _getStrength(person) {
    if (!person) return 0.5;
    if (person.physiology?.getHealthStatus) return person.physiology.getHealthStatus(this.kernel).strength ?? 0.5;
    return person.strength ?? 0.5;
  }

  _fatigueFactor(person) {
    if (person?.physiology?.getHealthStatus) {
      const s = person.physiology.getHealthStatus(this.kernel);
      if (typeof s.stamina === 'number') return 0.7 + s.stamina * 0.3;
    }
    return 1.0;
  }

  _fail(reason) {
    return { success: false, hit: false, damage: 0, location: null, cause: reason, ammoConsumed: false, reason };
  }
}

// Public read-only lookups for tests and external code.
RangedCombat.WEAPON_CATALOG = WEAPON_CATALOG;
RangedCombat.WEAPON_INDEX = WEAPON_INDEX;
RangedCombat.RANGE_BANDS = RANGE_BANDS;
RangedCombat.HIT_LOCATIONS = HIT_LOCATIONS;
RangedCombat.ARROW_MATERIAL = ARROW_MATERIAL;
RangedCombat.COVER_ACCURACY_PENALTY = COVER_ACCURACY_PENALTY;
RangedCombat.TURNS_PER_HOUR = TURNS_PER_HOUR;