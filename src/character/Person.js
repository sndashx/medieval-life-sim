import { Physiology } from './Physiology.js';
import { Needs, Skills } from './Needs.js';
import { Inventory } from './Inventory.js';
import { NPCBridge, AAA_FEATURES } from './aaa-npc/NPCBridge.js';

const MEMORY_RING_SIZE = 256;
const HEALTH_CACHE_VALID_MS = 60000; // re-compute health at most once per game-minute

export class Person {
  constructor(id, template, kernel) {
    this.id = id;
    this._kernel = kernel;
    this.name = template.name;
    this.age = template.age || 0;
    this.sex = template.sex;
    this.genetics = template.genetics || this.generateGenetics(kernel && kernel.rng);

    this.physiology = new Physiology(this.age, this.sex, this.genetics, kernel);
    Object.defineProperty(this.physiology, '_owner', { value: this, writable: true, enumerable: false, configurable: true });
    this.needs = new Needs(this.physiology);
    this.skills = new Skills();
    this.inventory = new Inventory(50);

    this.position = template.position || { x: 0, y: 0, z: 0 };
    this.household = template.household || null;
    this.occupation = template.occupation || 'peasant';

    // Per-person social state. Source of truth for affinity checks (Marriage,
    // Social.Relationships is a parallel system map we mirror for compatibility).
    if (!this.relationships || !(this.relationships instanceof Map)) this.relationships = new Map();
    if (this.marriage === undefined) this.marriage = null;
    if (!this.kinship) this.kinship = { mother: null, father: null, children: [], siblings: [] };

    this.personality = this.generatePersonality(kernel && kernel.rng);
    this.memory = new Memory(kernel);
    this.goals = null;
    this.currentAction = null;
    this.lastUrgentNeeds = 0;

    this.isPlayer = !!template.isPlayer;
    this.alive = true;
    this.deathCause = null;
    this.deathTurn = null;

    // Starvation tracking: turn at which hunger first crossed the critical threshold.
    this._hungerCriticalSince = -1;

    this.type = 'person';
    this.isPerson = true;

    // AAA NPC Bridge (optional, enabled via config)
    this.aaaBridge = null;
    if (template.enableAAA || kernel?.config?.enableAAA) {
      this.aaaBridge = new NPCBridge(this, {
        enabledFeatures: template.aaaFeatures || kernel?.config?.aaaFeatures || [],
        syncInterval: template.aaaSyncInterval || kernel?.config?.aaaSyncInterval || 60,
        lodDistance: kernel?.config?.lodDistance
      });
    }

    // Lazy tick scheduler — 0 means "tick every turn", default NPC initialises to a
    // staggered future turn so the first update doesn't synchronise across the whole world.
    this.nextInterestingTurn = template.isPlayer
      ? 0
      : ((kernel ? kernel.turn : 0) + (kernel ? kernel.rng.nextInt(1, 60) : 30));

    // Cached healthStatus — invalidated when setCachedHealth is called with null
    this._cachedHealth = null;
    this._cachedHealthTurn = -1;

    // AI state — null goals means "needs planning"
    this._goalsStale = true;

    // Bind so the kernel can call this.update(this, kernel) safely
    this.update = Person.prototype.update;
  }

  generateGenetics(rng) {
    const r = rng || { next: () => { throw new Error('rng required for Person.generateGenetics'); }, nextInt: (a, b) => { throw new Error('rng required for Person.generateGenetics'); } };
    return {
      height: 160 + r.next() * 30,
      baseWeight: 60 + r.next() * 30,
      eyeColor: r.next() < 0.25 ? 'brown' : r.next() < 0.33 ? 'blue' : r.next() < 0.5 ? 'green' : 'hazel',
      hairColor: r.next() < 0.4 ? 'black' : r.next() < 0.5 ? 'brown' : r.next() < 0.5 ? 'blonde' : 'red',
      skinTone: r.next()
    };
  }

  generatePersonality(rng) {
    const r = rng || { next: () => { throw new Error('rng required for Person.generatePersonality'); } };
    return {
      openness: r.next(),
      conscientiousness: r.next(),
      extraversion: r.next(),
      agreeableness: r.next(),
      neuroticism: r.next(),
      courage: r.next(),
      ambition: r.next(),
      compassion: r.next()
    };
  }

  /**
   * Called by SimulationKernel.updateActiveTier every tick (after physiology/needs).
   * Gated by nextInterestingTurn so idle NPCs cost ~nothing.
   */
  update(kernel) {
    if (!this.alive) return;
    const turn = kernel.turn;
    if (turn < this.nextInterestingTurn) return;

    const urgent = this._computeUrgentNeeds();

    // Update AAA NPC systems if enabled (respects same tick scheduler)
    if (this.aaaBridge) {
      this.aaaBridge.update(kernel);
    }

    if (!this.isPlayer) {
      if (this._goalsStale || this.lastUrgentNeeds !== urgent) {
        this._planGoals(urgent, kernel);
        this._goalsStale = false;
        this.lastUrgentNeeds = urgent;
      }
      if (!this.currentAction && this.goals && this.goals.length > 0) {
        this.currentAction = this._planAction(this.goals[0], kernel);
      }
      if (this.goals && this.goals.length > 0) this._everHadGoals = true;
      if (this.currentAction) this._everHadAction = true;
      if (this.currentAction) {
        this._executeAction(kernel);
      }
    }

    // Skill decay is bucketed by turn%60 (see Needs.decay) — only do it on bucket ticks.
    if ((turn & 63) === (this.id & 63)) {
      this.skills.decay(60);
    }

    // If nothing pressing, skip a full hour of ticks.
    const skip = urgent === 0 ? 60 : (urgent > 1 ? 1 : 10);
    this.nextInterestingTurn = turn + skip;
  }

  _computeUrgentNeeds() {
    let mask = 0;
    const n = this.needs;
    if (n.hunger > 0.7) mask |= 1;
    if (n.thirst > 0.7) mask |= 2;
    if (n.sleep > 0.8) mask |= 4;
    if (n.warmth < 0.3) mask |= 8;
    return mask;
  }

  _planGoals(urgentMask, kernel) {
    // Try AAA decision system first if enabled
    if (this.aaaBridge && this.aaaBridge.isFeatureEnabled(AAA_FEATURES.DECISIONS)) {
      const context = this.aaaBridge.buildContext(kernel);
      const aaaGoals = this.aaaBridge.planGoals(context);
      if (aaaGoals && aaaGoals.length > 0) {
        this.goals = aaaGoals;
        return;
      }
    }

    // Fallback to legacy goal planning
    const goals = [];
    if (urgentMask & 1) goals.push({ type: 'satisfy_need', need: 'hunger', priority: 10 });
    if (urgentMask & 2) goals.push({ type: 'satisfy_need', need: 'thirst', priority: 10 });
    if (urgentMask & 4) goals.push({ type: 'satisfy_need', need: 'sleep', priority: 9 });
    if (urgentMask & 8) goals.push({ type: 'find_warmth', priority: 8 });

    if (goals.length === 0) {
      const r = kernel.rng;
      if (this.inventory.count('food') < 3) goals.push({ type: 'acquire_food', priority: 7 });
      if (this.household) {
        const h = kernel.entities.get(this.household);
        if (h && h.food < 50) goals.push({ type: 'work', priority: 6 });
      }
      if (this.age > 18 && !this.physiology.pregnant && r.next() < 0.01) {
        goals.push({ type: 'find_partner', priority: 5 });
      }
      if (r.next() < 0.05) goals.push({ type: 'socialize', priority: 4 });
      // T3-2: priests and devout personalities occasionally seek worship.
      if (this.occupation === 'priest' || (this.personality && this.personality.agreeableness > 0.7)) {
        if (r.next() < 0.08) goals.push({ type: 'worship', priority: 3 });
      }
    }

    if (goals.length > 1) goals.sort((a, b) => b.priority - a.priority);
    this.goals = goals;
  }

  _planAction(goal) {
    if (goal.type === 'satisfy_need') {
      if (goal.need === 'hunger') {
        const food = this.inventory.find(i => i.type === 'food');
        return food ? { type: 'eat', item: food, duration: 10 } : { type: 'find_food', duration: 60 };
      }
      if (goal.need === 'thirst') return { type: 'find_water', duration: 30 };
      if (goal.need === 'sleep') return { type: 'sleep', duration: 480 };
    }
    if (goal.type === 'find_warmth') return { type: 'find_shelter', duration: 60 };
    if (goal.type === 'acquire_food') {
      // T3-2: bias toward foraging/gathering; if flora exists in the world,
      // try gathering, otherwise plain forage. If a shop is nearby and we
      // have money, prefer to buy (saves time).
      const game = this._kernel?.game;
      const hasShop = game && this._findNearbyShop(game) != null;
      const hasMoney = this._liquidCopper() >= 5;
      if (hasShop && hasMoney) return { type: 'trade', intent: 'buy_food', duration: 30 };
      if (game?.flora && (game.flora.plants?.size || 0) > 0) {
        return { type: 'gather', duration: 120 };
      }
      return { type: 'forage', duration: 120 };
    }
    if (goal.type === 'work') {
      // T3-2: craftsmen/masons/forge workers can craft directly.
      if (this.occupation === 'craftsman' || this.occupation === 'merchant') {
        return { type: 'craft', recipe: 'tool', duration: 240 };
      }
      return { type: 'work', occupation: this.occupation, duration: 480 };
    }
    if (goal.type === 'find_partner') return { type: 'seek_partner', duration: 120 };
    if (goal.type === 'socialize') return { type: 'socialize', duration: 30 };
    if (goal.type === 'worship') return { type: 'worship', duration: 30 };
    return null;
  }

  _executeAction(kernel) {
    this.currentAction.duration -= 1;
    if (this.currentAction.duration > 0) return;

    const action = this.currentAction;
    const r = kernel.rng;
    const game = kernel.game;

    if (action.type === 'eat') {
      this.physiology.consume(action.item);
      this.inventory.remove(action.item.type, 1);
      this.needs.satisfy('hunger', 0.5);
    } else if (action.type === 'find_water') {
      this.physiology.drink({ volume: 0.5, contaminated: r.next() < 0.1 }, r);
      this.needs.satisfy('thirst', 0.6);
    } else if (action.type === 'sleep') {
      this.needs.satisfy('sleep', 1.0);
      this.physiology.fatigue = 0;
    } else if (action.type === 'find_shelter') {
      this.needs.warmth = Math.min(1, this.needs.warmth + 0.5);
    } else if (action.type === 'forage' || action.type === 'gather') {
      const success = r.next() < 0.5 + this.skills.survival.foraging * 0.3;
      if (success) {
        this.inventory.add({ type: 'food', calories: 150, protein: 5, mass: 0.2 });
      }
      this.skills.train('foraging', 'survival', 0.5, action.duration);
    } else if (action.type === 'craft') {
      // T3-2: call game.crafting.craft if we have materials and the
      // character is technically able. Use the recipe chosen by _planAction.
      if (game?.crafting?.canCraft) {
        const recipe = action.recipe || 'tool';
        const check = game.crafting.canCraft(this, recipe, this.inventory);
        if (check && check.can) {
          try { game.crafting.craft(this, recipe, this.inventory, kernel); } catch (e) { /* recipe failed */ }
        }
      }
    } else if (action.type === 'trade') {
      // T3-2: visit a nearby shop and buy food.
      if (game?.trading?.buyItem) {
        const shop = this._findNearbyShop(game);
        if (shop) {
          try { game.trading.buyItem(this, shop.id, 'food', null, 1); } catch (e) { /* out of stock */ }
          this.needs.satisfy('hunger', 0.3);
        }
      }
    } else if (action.type === 'worship') {
      // T3-2: visit local temple and pray.
      if (game?.religion?.pray) {
        const sid = this.position?.settlementId ?? 0;
        const temple = this._findLocalTemple(game, sid);
        if (temple) {
          const deityId = temple.deityId || game.religion.pantheon?.deities?.[0]?.id;
          if (deityId) {
            try { game.religion.pray(this, deityId, 'private'); } catch (e) { /* prayer failed */ }
            this.needs.stress = Math.max(0, (this.needs.stress || 0) - 0.1);
          }
        }
      }
    } else if (action.type === 'work') {
      const household = kernel.entities.get(this.household);
      if (household) {
        const productivity = this.skills.knowledge.agriculture * this.getHealthStatus().strength;
        household.addWealth(productivity * 10);
        household.food += productivity * 5;
      }
    } else if (action.type === 'socialize') {
      // T3-2: actually call game.relationships.createBond / modifyAffinity.
      const peers = this._findNearbyPeople(kernel, 10);
      let touched = false;
      for (const other of peers) {
        if (!game?.relationships) break;
        const bond = game.relationships.getBond(this.id, other.id);
        if (bond) {
          try { game.relationships.modifyAffinity(this.id, other.id, 0.05); } catch (e) {}
        } else {
          try { game.relationships.createBond(this.id, other.id, 0.1, 'acquaintance'); } catch (e) {}
        }
        // Mirror to per-person relationship map for consistency.
        if (this.relationships) {
          const mine = this.relationships.get(this.id, other.id);
          if (mine) mine.affection = Math.min(1, (mine.affection || 0) + 0.02);
          else try { this.relationships.add(this.id, other.id, { affection: 0.1, type: 'acquaintance' }); } catch (e) {}
        }
        touched = true;
        break;
      }
      if (!touched) {
        // Fall back to the per-person map only.
        if (this.relationships) {
          try { this.relationships.add(this.id, this.id, { affection: 0.0, type: 'self' }); } catch (e) {}
        }
      }
    } else if (action.type === 'seek_partner') {
      // T3-2: actually move toward the nearest eligible partner in our
      // settlement, not just a random settlement. Falls back to a random
      // settlement step if no candidate is found in range.
      const partner = this._findEligiblePartner(kernel, game);
      if (partner && partner.position) {
        const dx = Math.sign(partner.position.x - this.position.x);
        const dy = Math.sign(partner.position.y - this.position.y);
        if (dx !== 0) this.position.x += dx;
        else if (dy !== 0) this.position.y += dy;
        // If we just arrived, nudge affinity so marriage system can pick it up.
        if (dx === 0 && dy === 0 && game?.relationships) {
          try { game.relationships.createBond(this.id, partner.id, 0.2, 'romantic_interest'); } catch (e) {}
        }
      } else {
        const settlements = kernel.world?.settlements || kernel.settlements || [];
        if (settlements.length > 0) {
          const target = settlements[Math.floor(r.next() * settlements.length)];
          if (target && this.position) {
            const dx = Math.sign(target.x - this.position.x);
            const dy = Math.sign(target.y - this.position.y);
            this.position.x += dx;
            this.position.y += dy;
          }
        }
      }
    }

    this.currentAction = null;
    if (this.goals && this.goals.length > 0) this.goals.shift();
    if (!this.goals || this.goals.length === 0) this._goalsStale = true;
  }

  // ─── Action helpers ────────────────────────────────────────────────

  _liquidCopper() {
    const purse = this.purse || {};
    return (purse.copper || 0) + (purse.silver || 0) * 10 + (purse.gold || 0) * 100;
  }

  _findNearbyShop(game) {
    if (!game?.trading?.shops) return null;
    const x = this.position?.x ?? 0;
    const y = this.position?.y ?? 0;
    const sid = this.position?.settlementId;
    let best = null;
    let bestDist = Infinity;
    for (const shop of game.trading.shops.values()) {
      if (!shop || !shop.location) continue;
      if (sid !== undefined && shop.location.settlementId !== undefined
          && shop.location.settlementId !== sid) continue;
      const dx = (shop.location.x ?? 0) - x;
      const dy = (shop.location.y ?? 0) - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = shop; }
    }
    return best;
  }

  _findLocalTemple(game, settlementId) {
    if (!game?.religion?.temples) return null;
    for (const temple of game.religion.temples.values()) {
      if (!temple) continue;
      const tsid = temple.location?.settlementId;
      if (tsid !== undefined && tsid !== settlementId) continue;
      if (temple.location && this.position) {
        const dx = (temple.location.x ?? 0) - (this.position.x ?? 0);
        const dy = (temple.location.y ?? 0) - (this.position.y ?? 0);
        if (dx * dx + dy * dy > 400) continue;
      }
      return temple;
    }
    return null;
  }

  _findNearbyPeople(kernel, radius) {
    const out = [];
    if (!kernel.entityIndex?.query) return out;
    let nearby = [];
    try { nearby = kernel.entityIndex.query(this.position.x, this.position.y, this.position.z, radius, 5) || []; }
    catch (e) { nearby = kernel.queryEntitiesNear ? kernel.queryEntitiesNear(this.position.x, this.position.y, this.position.z, radius) : []; }
    for (const id of nearby) {
      if (id === this.id) continue;
      const other = kernel.entities.get(id);
      if (!other || !other.alive || !other.name) continue;
      if ((other.age ?? 0) < 12) continue;
      out.push(other);
      if (out.length >= 3) break;
    }
    return out;
  }

  _findEligiblePartner(kernel, game) {
    if (!game?.marriage) return null;
    const mySid = this.position?.settlementId;
    const oppositeSex = this.sex === 'male' ? 'female' : 'male';
    const bucket = mySid !== undefined ? kernel.bySettlement?.get?.(mySid) : null;
    const candidates = [];
    if (bucket) {
      for (const p of bucket) {
        if (p === this || !p.alive) continue;
        if (p.sex !== oppositeSex) continue;
        if ((p.age ?? 0) < 16 || (p.age ?? 0) > 60) continue;
        candidates.push(p);
      }
    }
    if (candidates.length === 0) return null;
    // Pick the closest.
    let best = null;
    let bestDist = Infinity;
    for (const p of candidates) {
      const dx = (p.position?.x ?? 0) - (this.position?.x ?? 0);
      const dy = (p.position?.y ?? 0) - (this.position?.y ?? 0);
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  die(cause, kernel) {
    if (!this.alive) return;
    this.alive = false;
    this.deathCause = cause;
    this.deathTurn = kernel ? kernel.turn : null;
    this._cachedHealth = null;

    if (kernel) {
      // Remove from active/regional/distant tiers immediately so no further
      // ticks happen for this person.
      kernel.activeTier.delete(this.id);
      kernel.regionalTier.delete(this.id);
      kernel.distantTier.delete(this.id);

      // Decrement household membership. Skips if no household or no record.
      if (this.household) {
        const household = kernel.entities.get(this.household);
        if (household && typeof household.removeMember === 'function') {
          household.removeMember(this.id);
        }
        this.household = null;
      }

      // Notify kinship so lineage / spouse linkage can mark the death.
      const game = kernel.game;
      if (game && game.kinship && typeof game.kinship.recordDeath === 'function') {
        try { game.kinship.recordDeath(this.id, { cause, turn: kernel.turn }); }
        catch (e) { console.error(`[Person.die] kinship.recordDeath failed for ${this.id}:`, e); }
      }

      // Drop out of secondary indexes so queries stop returning the dead.
      kernel.alivePeople.delete(this);
      if (this.sex === 'male') kernel.bySex.male.delete(this);
      else if (this.sex === 'female') kernel.bySex.female.delete(this);
      const sid = this.position && this.position.settlementId;
      if (sid !== undefined) {
        const s = kernel.bySettlement.get(sid);
        if (s) s.delete(this);
      }
      let typeSet = kernel.byType.get('person');
      if (typeSet) typeSet.delete(this);

      kernel.conservationLedger.population = Math.max(0, (kernel.conservationLedger.population || 0) - 1);
      kernel.conservationDirty = true;
    }

    // Schedule the public events last so listeners see a consistent dead state.
    if (kernel && typeof kernel.scheduleEvent === 'function') {
      kernel.scheduleEvent({ type: 'person_died', personId: this.id, cause, age: this.age });
      if (this.isPlayer) kernel.scheduleEvent({ type: 'player_death', personId: this.id, cause });
    }
  }

  canSucceed() { return this.age >= 12 && this.alive; }

  /**
   * Cached health status. Caller invalidates by passing null OR by modifying
   * physiology in a way that should re-check; the cache is keyed on the kernel turn.
   */
  getHealthStatus(kernel) {
    if (this._cachedHealth && kernel && this._cachedHealthTurn === kernel.turn) return this._cachedHealth;
    const phys = this.physiology;
    const limbFunction = (
      phys.anatomy.limbs.leftArm.integrity +
      phys.anatomy.limbs.rightArm.integrity +
      phys.anatomy.limbs.leftLeg.integrity +
      phys.anatomy.limbs.rightLeg.integrity
    ) * 0.25;
    const organFunction = (
      phys.anatomy.torso.heart.function +
      phys.anatomy.torso.lungs.left +
      phys.anatomy.torso.lungs.right +
      phys.anatomy.torso.liver.function +
      phys.anatomy.torso.kidneys.left +
      phys.anatomy.torso.kidneys.right
    ) / 6;
    const overall = (limbFunction + organFunction + phys.anatomy.head.brain.function) / 3;
    const cached = {
      overall,
      mobility: limbFunction,
      strength: limbFunction * (1 - phys.fatigue),
      dexterity: phys.anatomy.limbs.rightArm.nerves * (1 - phys.fatigue),
      cognition: phys.anatomy.head.brain.function,
      pain: phys.pain,
      fatigue: phys.fatigue
    };
    this._cachedHealth = cached;
    this._cachedHealthTurn = kernel ? kernel.turn : -1;
    return cached;
  }

  getStatus() {
    // Use AAA bridge status if available
    if (this.aaaBridge) {
      return this.aaaBridge.getStatus();
    }

    // Fallback to legacy status
    const health = this.getHealthStatus();
    return {
      name: this.name,
      age: Math.floor(this.age),
      sex: this.sex,
      alive: this.alive,
      health: { overall: health.overall, pain: health.pain, fatigue: health.fatigue },
      needs: { hunger: this.needs.hunger, thirst: this.needs.thirst, sleep: this.needs.sleep },
      position: this.position,
      occupation: this.occupation
    };
  }

  aggregateToRegional() {
    return {
      interval: 60,
      alive: this.alive,
      age: this.age,
      health: this.physiology.getHealthStatus().overall,
      hunger: this.needs.hunger,
      thirst: this.needs.thirst,
      sleep: this.needs.sleep,
      // Preserve live social-state refs so materialisation doesn't lose them.
      relationships: this.relationships,
      marriage: this.marriage,
      kinship: this.kinship,
      _hungerCriticalSince: this._hungerCriticalSince
    };
  }

  materializeFromRegional(snapshot) {
    if (!snapshot) return;
    this.alive = snapshot.alive;
    this.age = snapshot.age;
    this._cachedHealth = null;
    if (typeof snapshot.hunger === 'number') {
      this.needs.hunger = snapshot.hunger;
      this.needs.thirst = snapshot.thirst;
      this.needs.sleep = snapshot.sleep;
    }
    if (snapshot.relationships) this.relationships = snapshot.relationships;
    if (snapshot.marriage !== undefined) this.marriage = snapshot.marriage;
    if (snapshot.kinship) this.kinship = snapshot.kinship;
    if (typeof snapshot._hungerCriticalSince === 'number') this._hungerCriticalSince = snapshot._hungerCriticalSince;
    // Re-stagger so the next active tick isn't immediate
    this.nextInterestingTurn = this._kernel ? this._kernel.turn + this._kernel.rng.nextInt(1, 60) : 0;
  }

  aggregateToDistant() {
    return { alive: this.alive, age: this.age, occupation: this.occupation };
  }

  restoreFromDistant(snapshot) {
    this.alive = snapshot.alive;
    this.age = snapshot.age;
    this._cachedHealth = null;
  }

  /**
   * T7-2: Serialize the per-person fields that aren't trivially enumerable
   * (cached health, scheduler turn, goals, current action, memory ring).
   * Also captures Wave 1 social state (relationships, marriage, kinship) and
   * the starvation tracker so a fresh Person round-trips through JSON cleanly.
   *
   * Notes:
   * - memory uses a sparse ring buffer; we emit only the populated entries
   *   (memory.events is an Array of size MEMORY_RING_SIZE with `undefined`
   *   holes — JSON.stringify already drops those, but we also drop head/size
   *   into explicit fields for safety).
   * - relationships is a Map of `personId -> { affection, type }`; we
   *   convert to Array of [id, bond] so JSON preserves it.
   */
  toJSON() {
    const data = {
      _cachedHealth: this._cachedHealth || null,
      _cachedHealthTurn: this._cachedHealthTurn,
      nextInterestingTurn: this.nextInterestingTurn,
      goals: this.goals,
      currentAction: this.currentAction,
      _goalsStale: this._goalsStale,
      lastUrgentNeeds: this.lastUrgentNeeds,
      _hungerCriticalSince: this._hungerCriticalSince,
      relationships: serializeRelationships(this.relationships),
      marriage: this.marriage === undefined ? null : this.marriage,
      kinship: this.kinship,
      memory: serializeMemory(this.memory)
    };

    // Serialize AAA bridge if present
    if (this.aaaBridge) {
      data.aaaBridge = this.aaaBridge.serialize();
    }

    return data;
  }

  /**
   * T7-2: Restore the fields written by toJSON. Tolerant of older saves
   * missing any of these (defaults are sensible).
   */
  fromJSON(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;
    if (snapshot._cachedHealth !== undefined) this._cachedHealth = snapshot._cachedHealth;
    if (typeof snapshot._cachedHealthTurn === 'number') this._cachedHealthTurn = snapshot._cachedHealthTurn;
    if (typeof snapshot.nextInterestingTurn === 'number') {
      // If the saved turn is in the past, restagger into the future so the
      // first tick after load doesn't synchronise the whole population.
      const turn = this._kernel ? this._kernel.turn : 0;
      if (snapshot.nextInterestingTurn < turn) {
        this.nextInterestingTurn = turn + (this._kernel ? this._kernel.rng.nextInt(1, 60) : 30);
      } else {
        this.nextInterestingTurn = snapshot.nextInterestingTurn;
      }
    }
    if (snapshot.goals !== undefined) this.goals = snapshot.goals;
    if (snapshot.currentAction !== undefined) this.currentAction = snapshot.currentAction;
    if (typeof snapshot._goalsStale === 'boolean') this._goalsStale = snapshot._goalsStale;
    if (typeof snapshot.lastUrgentNeeds === 'number') this.lastUrgentNeeds = snapshot.lastUrgentNeeds;
    if (typeof snapshot._hungerCriticalSince === 'number') this._hungerCriticalSince = snapshot._hungerCriticalSince;
    if (snapshot.marriage !== undefined) this.marriage = snapshot.marriage;
    if (snapshot.kinship) this.kinship = snapshot.kinship;
    if (snapshot.relationships) this.relationships = deserializeRelationships(snapshot.relationships);
    if (snapshot.memory) this.memory = deserializeMemory(snapshot.memory);

    // Deserialize AAA bridge if present
    if (snapshot.aaaBridge) {
      this.aaaBridge = NPCBridge.deserialize(snapshot.aaaBridge, this);
    }
  }
}

class Memory {
  constructor(kernel = null) {
    this._kernel = kernel;
    this.events = new Array(MEMORY_RING_SIZE);
    this.head = 0;
    this.size = 0;
    this.knowledge = new Map();
    this.relationships = new Map();
  }
  remember(event) {
    this.events[this.head] = { ...event, remembered: this._kernel?.turn ?? 0 };
    this.head = (this.head + 1) % MEMORY_RING_SIZE;
    if (this.size < MEMORY_RING_SIZE) this.size++;
  }
  recall(query) {
    const out = [];
    for (let i = 0; i < this.size; i++) {
      const e = this.events[(this.head - 1 - i + MEMORY_RING_SIZE) % MEMORY_RING_SIZE];
      if (e && (e.type === query.type || e.location === query.location || e.person === query.person)) {
        out.push(e);
      }
    }
    return out;
  }
  learn(fact) { this.knowledge.set(fact.id, fact); }
  knows(factId) { return this.knowledge.has(factId); }
}

/**
 * T7-2: Memory ring buffer serialisation. The `events` slot array is sparse
 * (entries beyond `size` are `undefined`), so we emit a compact form:
 *   { head, size, events: [e0, e1, ...], knowledge: [[id, fact], ...],
 *     relationships: [[id, fact], ...] }
 * Deserialisation rebuilds the fixed-size ring array, leaving any unset
 * slots as `undefined` to preserve original semantics.
 */
function serializeMemory(memory) {
  if (!memory) return null;
  return {
    head: memory.head | 0,
    size: memory.size | 0,
    events: Array.from(memory.events),
    knowledge: memory.knowledge instanceof Map ? Array.from(memory.knowledge.entries()) : [],
    relationships: memory.relationships instanceof Map ? Array.from(memory.relationships.entries()) : []
  };
}

function deserializeMemory(snapshot) {
  const m = new Memory();
  if (!snapshot) return m;
  m.head = snapshot.head | 0;
  m.size = snapshot.size | 0;
  const src = Array.isArray(snapshot.events) ? snapshot.events : [];
  m.events = new Array(MEMORY_RING_SIZE);
  // Preserve original slot positions when the buffer roundtripped intact;
  // otherwise fall back to a compact copy and reset head/size.
  if (snapshot.head !== undefined && snapshot.size !== undefined &&
      src.length === MEMORY_RING_SIZE) {
    for (let i = 0; i < MEMORY_RING_SIZE; i++) m.events[i] = src[i];
  } else {
    for (let i = 0; i < src.length && i < MEMORY_RING_SIZE; i++) m.events[i] = src[i];
    m.head = src.length % MEMORY_RING_SIZE;
    m.size = Math.min(src.length, MEMORY_RING_SIZE);
  }
  // Knowledge / relationships may have come back as plain {} (raw JSON of a
  // Map). Map.keys() of an empty object yields [] — same as empty Map.
  m.knowledge = new Map(snapshot.knowledge instanceof Map
    ? snapshot.knowledge.entries()
    : (Array.isArray(snapshot.knowledge) ? snapshot.knowledge : []));
  m.relationships = new Map(snapshot.relationships instanceof Map
    ? snapshot.relationships.entries()
    : (Array.isArray(snapshot.relationships) ? snapshot.relationships : []));
  return m;
}

/**
 * T7-2: Relationships map serialisation. The Map stores personId -> bond.
 * Map isn't JSON-serialisable natively.
 */
function serializeRelationships(rels) {
  if (!rels || !(rels instanceof Map)) return [];
  return Array.from(rels.entries());
}

function deserializeRelationships(snapshot) {
  if (!snapshot) return new Map();
  if (snapshot instanceof Map) return snapshot;
  if (Array.isArray(snapshot)) return new Map(snapshot);
  // Raw JSON of a Map comes back as a plain object {id: bond, ...}.
  if (typeof snapshot === 'object') return new Map(Object.entries(snapshot));
  return new Map();
}