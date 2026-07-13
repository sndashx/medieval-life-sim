/**
 * Magic.js
 *
 * A naturalistic magic system that fits the medieval setting:
 * - Mana draws from belief, ritual, and rare materials
 * - Spells are cast via Religion (divine) or arcane study (Knowledge)
 * - Each spell has a cost, range, duration, and consequence
 * - Backlash can harm the caster; overuse can attract supernatural attention
 * - Artifacts are persistent magical objects tied to a caster
 *
 * Even in a "realistic medieval" world, this system lets the player opt into
 * fantasy via `religion` + `technology` investments.
 */

export const SPELL_TYPES = {
  healing: { cost: 10, range: 'touch', duration: 'instant', school: 'divine' },
  detect_life: { cost: 5, range: 'sight', duration: '1min', school: 'arcane' },
  light: { cost: 2, range: 'self', duration: '1hour', school: 'arcane' },
  bless: { cost: 15, range: 'voice', duration: '1day', school: 'divine' },
  curse: { cost: 20, range: 'sight', duration: '1day', school: 'arcane' },
  summon_spirit: { cost: 50, range: 'ritual', duration: '1hour', school: 'divine' },
  ward: { cost: 25, range: 'touch', duration: '1week', school: 'arcane' },
  divination: { cost: 30, range: 'self', duration: 'instant', school: 'divine' },
  necromancy: { cost: 60, range: 'ritual', duration: '1hour', school: 'arcane' },
  miracle: { cost: 200, range: 'voice', duration: 'permanent', school: 'divine' }
};

export class Magic {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    /** mana pools per person: personId -> { current, max, regen } */
    this.pools = new Map();
    /** known spells per person: personId -> Set<spellName> */
    this.knownSpells = new Map();
    /** active spell effects */
    this.activeEffects = [];
    /** artifacts */
    this.artifacts = new Map();
    this.nextEffectId = 1;
    this.nextArtifactId = 1;
    /** legendary events: world-shaping magic */
    this.legendaryEvents = [];
  }

  _getPool(person) {
    if (!this.pools.has(person.id)) {
      const belief = person.skills?.mental?.faith?.level || person.faith || 0;
      this.pools.set(person.id, {
        current: 50 + belief,
        max: 100 + belief * 2,
        regen: 0.1
      });
    }
    return this.pools.get(person.id);
  }

  _getKnownSpells(person) {
    if (!this.knownSpells.has(person.id)) {
      const religion = person.occupation === 'priest';
      const defaults = religion
        ? ['healing', 'bless', 'divination']
        : ['detect_life', 'light'];
      this.knownSpells.set(person.id, new Set(defaults));
    }
    return this.knownSpells.get(person.id);
  }

  /**
   * Learn a spell. Requires skill/faith and study time.
   */
  learnSpell(person, spellName, hours = 8) {
    const def = SPELL_TYPES[spellName];
    if (!def) return { success: false, reason: 'Unknown spell' };
    const religion = person.occupation === 'priest';
    if (def.school === 'divine' && !religion) {
      return { success: false, reason: 'Only priests can learn divine spells' };
    }
    if (def.school === 'arcane' && religion) {
      return { success: false, reason: 'Clergy study divine magic, not arcane' };
    }
    const known = this._getKnownSpells(person);
    if (known.has(spellName)) return { success: false, reason: 'Already known' };
    known.add(spellName);
    return { success: true, spell: spellName, hours, cost: def.cost };
  }

  /**
   * Cast a spell. Consumes mana, applies effect, may cause backlash.
   */
  cast(caster, spellName, target = null, options = {}) {
    const def = SPELL_TYPES[spellName];
    if (!def) return { success: false, reason: 'Unknown spell' };
    const known = this._getKnownSpells(caster);
    if (!known.has(spellName)) return { success: false, reason: `You don't know ${spellName}` };
    const pool = this._getPool(caster);
    if (pool.current < def.cost) return { success: false, reason: `Not enough mana (need ${def.cost}, have ${Math.floor(pool.current)})` };

    // Deduct cost
    pool.current -= def.cost;

    // Roll for backlash (low skill = more backlash)
    const skill = caster.skills?.mental?.magic?.level || (caster.occupation === 'priest' ? 0.5 : 0.2);
    const backlashChance = Math.max(0, 0.2 - skill * 0.3);
    const backlash = this.kernel.random() < backlashChance;
    if (backlash) {
      caster.physiology?.applyDamage?.(caster, 0.05, 'arcane backlash');
      pool.current = Math.max(0, pool.current - def.cost * 0.5);
    }

    // Apply the effect
    const effect = this._applyEffect(caster, spellName, def, target);
    if (caster !== this.game?.player) {
      this.game?.kernel?.emit?.('spell_cast', { caster: caster.id, spell: spellName, target: target?.id });
    }
    return { success: true, effect, backlash };
  }

  _applyEffect(caster, spellName, def, target) {
    const id = this.nextEffectId++;
    const effect = {
      id,
      caster: caster.id,
      spell: spellName,
      target: target?.id ?? caster.id,
      school: def.school,
      castAt: this.kernel?.turn ?? 0,
      duration: def.duration
    };

    switch (spellName) {
      case 'healing': {
        if (target?.physiology) {
          target.physiology.health = Math.min(1, (target.physiology.health || 1) + 0.3);
          for (const inj of target.physiology.injuries || []) {
            inj.healing = (inj.healing || 0) + 0.1;
          }
        }
        break;
      }
      case 'light': {
        effect.bonus = 'illumination_self';
        break;
      }
      case 'bless': {
        if (target) target.morale = Math.min(1, (target.morale || 0.5) + 0.2);
        break;
      }
      case 'curse': {
        if (target) target.morale = Math.max(0, (target.morale || 0.5) - 0.2);
        if (target?.physiology) target.physiology.strength = (target.physiology.strength || 1) * 0.9;
        break;
      }
      case 'ward': {
        effect.bonus = 'protection';
        break;
      }
      case 'detect_life': {
        if (this.game?.kernel?.queryEntitiesNear && target) {
          const nearby = this.game.kernel.queryEntitiesNear(target.position?.x || 0, target.position?.y || 0, 0, 20);
          effect.detected = nearby.length;
        }
        break;
      }
      case 'divination': {
        effect.revelation = `The threads of fate show a ${this.kernel.random() < 0.5 ? 'hopeful' : 'ominous'} path.`;
        break;
      }
      case 'summon_spirit':
      case 'necromancy':
      case 'miracle': {
        // Legendary: world takes notice. Only clergy may safely wield these;
        // a lay caster triggers backlash (small chance of caster death).
        const isClergy = caster.occupation === 'priest' || caster.clergy;
        this.legendaryEvents.push({
          type: spellName,
          caster: caster.id,
          clergy: !!isClergy,
          time: this.kernel?.turn ?? 0
        });
        effect.legendary = true;
        if (!isClergy) {
          // Backlash: heavy damage to caster, possible death
          const dmg = 0.3;
          if (caster.physiology?.applyDamage) {
            caster.physiology.applyDamage(caster, dmg, `${spellName} backlash`);
          }
          if (caster.physiology?.health !== undefined && caster.physiology.health <= 0 && typeof caster.die === 'function') {
            caster.die(`${spellName} backlash`, this.kernel);
          }
          effect.backlash = true;
        } else {
          // Successful legendary: notify the world.
          if (this.game?.notifyUI) {
            const label = spellName.replace('_', ' ');
            this.game.notifyUI(`✦ ${caster.name || 'Someone'} works a ${label}. The world takes notice.`, 'system');
          }
          if (this.game?.kernel?.emit) {
            this.game.kernel.emit('legendary_event', { spell: spellName, caster: caster.id });
          }
        }
        break;
      }
    }
    this.activeEffects.push(effect);
    return effect;
  }

  /**
   * Create a persistent magical artifact tied to a caster.
   */
  forgeArtifact(caster, name, properties = {}) {
    const artifact = {
      id: this.nextArtifactId++,
      name,
      forger: caster.id,
      forged: this.kernel?.turn ?? 0,
      properties,
      charges: 10,
      attunements: [caster.id]
    };
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  /** Per-tick: mana regen, effect expiry. */
  update(turn) {
    for (const [pid, pool] of this.pools) {
      pool.current = Math.min(pool.max, pool.current + pool.regen);
    }
    const now = this.kernel?.turn ?? 0;
    const expiry = { instant: 0, '1min': 60 * 1000, '1hour': 3600 * 1000, '1day': 86400 * 1000, '1week': 604800 * 1000, permanent: Infinity };
    this.activeEffects = this.activeEffects.filter(e => {
      const ms = expiry[e.duration] ?? 0;
      return now - e.castAt < ms;
    });
  }

  getKnownSpells(person) {
    return Array.from(this._getKnownSpells(person));
  }

  getPool(person) {
    return this._getPool(person);
  }

  getActiveEffects() {
    return [...this.activeEffects];
  }

  getArtifacts() {
    return Array.from(this.artifacts.values());
  }

  getLegendaryEvents() {
    return [...this.legendaryEvents];
  }

  toJSON() {
    return {
      pools: Array.from(this.pools.entries()),
      knownSpells: Array.from(this.knownSpells.entries()).map(([k, v]) => [k, Array.from(v)]),
      activeEffects: this.activeEffects,
      artifacts: Array.from(this.artifacts.entries()),
      nextEffectId: this.nextEffectId,
      nextArtifactId: this.nextArtifactId,
      legendaryEvents: this.legendaryEvents
    };
  }
  fromJSON(data) {
    if (!data) return;
    if (data.pools) this.pools = new Map(data.pools);
    if (data.knownSpells) this.knownSpells = new Map(data.knownSpells.map(([k, v]) => [k, new Set(v)]));
    if (data.activeEffects) this.activeEffects = data.activeEffects;
    if (data.artifacts) this.artifacts = new Map(data.artifacts);
    if (data.nextEffectId) this.nextEffectId = data.nextEffectId;
    if (data.nextArtifactId) this.nextArtifactId = data.nextArtifactId;
    if (data.legendaryEvents) this.legendaryEvents = data.legendaryEvents;
  }
}