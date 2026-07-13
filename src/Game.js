import { SimulationKernel } from './core/SimulationKernel.js';
import { WorldGenerator } from './world/WorldGenerator.js';
import { Person } from './character/Person.js';
import { registerSystems } from './core/SystemRegistry.js';
import { Perception, Vision, Hearing, Smell, Attention } from './systems/Perception.js';
import { Locomotion } from './systems/Locomotion.js';
import { Household } from './systems/Social.js';
import { NPCCoordinator } from './character/NPCCoordinator.js';

const REGIONAL_DEFAULT_INTERVAL = 60; // minutes per regional tick (1 hour)
const IDLE_NPC_NEXT_TURN_SKIP = 1440; // idle NPCs skipped for a full game-day

// T7-1: schemaVersion increments when save/load fields change shape. Older
// saves load best-effort with a console warning so we don't silently lose
// data after a refactor.
export const SAVE_SCHEMA_VERSION = 2;

export class Game {
  constructor(seed, worldConfig = null, options = {}) {
    // options.autoFeed (default true) — when false, the player must eat
    // manually via `eat`/`gather`/`hunt`/`forage`. Set false for hardcore
    // mode or test scenarios.
    this.autoFeed = options.autoFeed !== false;
    this._uiListeners = new Set();
    console.log('  → Initializing simulation kernel...');
    this.seed = seed || Date.now(); // AUDIT-WHITELIST: cli seed fallback
    this.worldConfig = worldConfig || {
      worldSize: { width: 100, height: 100 },
      settlements: 5,
      resources: 50,
      rivers: 5,
      populationMin: 50,
      populationMax: 500
    };
    this.kernel = new SimulationKernel(this.seed);
    // Back-reference so Person.die can reach this.kinship / this.factions
    // without circular-importing Social.js. Defined non-enumerable so
    // JSON.stringify(saveData) doesn't trip on the circular graph.
    Object.defineProperty(this.kernel, 'game', {
      value: this,
      writable: false,
      enumerable: false,
      configurable: true
    });
    this.world = null;
    this.player = null;
    this.playerHousehold = null;

    registerSystems(this);

    console.log('  → Setting up event handlers...');
    this.npcCoordinator = new NPCCoordinator(this);
    this.setupEventHandlers();
  }

  initialize() {
    console.log('\n📍 Generating world...');
    const worldGen = new WorldGenerator(this.seed, this.worldConfig);
    this.world = worldGen.generate(this.naturalWorld);
    if (this.kernel) this.kernel.world = this.world;
    if (this.ecology && typeof this.ecology.setWorld === 'function') {
      this.ecology.setWorld(this.world);
    }

    console.log('\n👥 Populating world...');
    this.populateWorld();

    // T3-1: promote ~10% of the regional-tier population to the active tier
    // so most NPCs are visible and acting. Bias toward high-traffic
    // occupations and prime-age adults in larger settlements. Failures are
    // swallowed because a malformed snapshot from regional tier is
    // non-fatal — the NPC just stays regional.
    this._promoteRegionalToActive();

    // T2-4 / T2-6: precompute the regional currency map so shop prices
    // use real multipliers from the very first buy/sell. Without this the
    // map starts empty and every shop charges the same baseline rate.
    if (this.landOwnership) this.landOwnership.recomputeRegionalCurrency();

    console.log('\n🐴 Populating vehicles...');
    if (this.transportation) this.transportation.populateForSettlements(this.world.settlements);

    console.log('\n✓ World ready!');
    return { success: true };
  }

  /**
   * T3-1: promote ~10% of the regional-tier population into the active tier
   * so most NPCs are visible and acting. Bias toward NPCs in large
   * settlements (pop > 20) with socially-interesting occupations
   * (craftsman, merchant, soldier, priest) and prime working age (16-60).
   * Failures from kernel.promoteToActive are silently skipped so a bad
   * regional snapshot doesn't crash world gen.
   */
  _promoteRegionalToActive() {
    if (!this.kernel?.regionalTier) return;
    const targetRatios = { craftsman: 1.0, merchant: 1.0, soldier: 1.0, priest: 1.0 };
    const fallbackRatio = 0.1;
    const primeAgeMax = 55; // skip the very-old to avoid mass heart-failure attrition
    const rng = this.kernel.rng;

    // Bucket regional NPCs by settlement so we can apply the per-settlement
    // population>20 filter.
    const bySettlement = new Map();
    for (const id of this.kernel.regionalTier.keys()) {
      const p = this.kernel.entities.get(id);
      if (!p || !p.alive) continue;
      const sid = p.position?.settlementId ?? 0;
      let bucket = bySettlement.get(sid);
      if (!bucket) { bucket = []; bySettlement.set(sid, bucket); }
      bucket.push(p);
    }

    let promoted = 0;
    for (const [sid, people] of bySettlement) {
      const settlement = this.world?.settlements?.[sid];
      const pop = settlement?.population ?? people.length;
      const highTraffic = pop > 20;

      for (const p of people) {
        const age = p.age ?? 0;
        const primeAge = age >= 16 && age <= primeAgeMax;
        const occ = p.occupation;
        const ratio = targetRatios[occ] !== undefined
          ? targetRatios[occ]
          : (highTraffic && primeAge ? fallbackRatio : 0);
        if (ratio <= 0) continue;
        if (ratio < 1 && rng.next() > ratio) continue;

        // Sticky-promote: mark the person so the kernel's distance-based
        // demotion in updateActiveTier leaves them alone. They were
        // intentionally surfaced for playability.
        p._stickyActive = true;
        try {
          this.kernel.promoteToActive(p);
          promoted++;
        } catch (e) {
          // Malformed regional snapshot — skip silently, NPC stays regional.
        }
      }
    }
    console.log(`  → Promoted ${promoted} regional NPCs to active tier`);
  }

  populateWorld() {
    let totalPeople = 0;
    let totalHouseholds = 0;

    const rng = this.kernel.rng;
    const verbose = process.env.MLS_VERBOSE_INIT === '1';

    for (let s = 0; s < this.world.settlements.length; s++) {
      const settlement = this.world.settlements[s];
      if (verbose) console.log(`  → Settlement ${s + 1}/${this.world.settlements.length}: ${settlement.name} (pop: ${settlement.population})`);

      if (verbose) console.log(`    • Initializing market...`);
      // TRACK 2: market wiring lives on Trading (single source of truth).
      // The legacy Economy.markets map is only kept for save/load compat.
      this.trading.initMarket(s, settlement.name, settlement);

      if (verbose) console.log(`    • Creating ${settlement.population} inhabitants...`);
      for (let i = 0; i < settlement.population; i++) {
        const age = rng.nextInt(0, 70);
        const sex = rng.next() < 0.5 ? 'male' : 'female';

        const person = this.createPerson({
          name: this.generateName(sex, rng),
          age: age,
          sex: sex,
          position: { x: settlement.x, y: settlement.y, z: 0, settlementId: s },
          occupation: this.assignOccupation(age, rng)
        }, /* initialTier */ 'regional');

        totalPeople++;

        if (i % 5 === 0) {
          const household = this.createHousehold(settlement.x, settlement.y, s);
          person.household = household.id;
          household.addMember(person.id, 'head');
          totalHouseholds++;
        }

        if (verbose && (i + 1) % 50 === 0) {
          console.log(`      ├─ Created ${i + 1}/${settlement.population} people...`);
        }
      }
      if (verbose) console.log(`    ✓ Settlement complete (${settlement.population} people, ${Math.floor(settlement.population / 5)} households)`);
    }

    // T3-3: promote a representative 20% slice of adult regional NPCs into
    // the active tier so _npcAutonomousTick can actually iterate them and
    // produce visible state changes (food, crafts, shop restocks). Without
    // this, only the player and a tiny handful of NPCs ever tick and the
    // simulation looks static.
    let promoted = 0;
    const promotionIds = [];
    for (const [entityId, schedule] of this.kernel.regionalTier) {
      const ent = this.kernel.entities.get(entityId);
      if (!ent || !ent.isPerson || ent.age < 18) continue;
      if (ent.id === this.player?.id) continue;
      promotionIds.push(ent);
    }
    // Shuffle deterministically (kernel RNG) and pick 20%.
    for (let i = promotionIds.length - 1; i > 0; i--) {
      const j = this.kernel.rng.nextInt(0, i);
      const tmp = promotionIds[i]; promotionIds[i] = promotionIds[j]; promotionIds[j] = tmp;
    }
    const target = Math.ceil(promotionIds.length * 0.2);
    for (let i = 0; i < target; i++) {
      try { this.kernel.promoteToActive(promotionIds[i]); promoted++; } catch (e) { /* skip */ }
    }
    if (verbose) console.log(`  → Promoted ${promoted}/${promotionIds.length} regional NPCs to active tier (20% sample)`);

    console.log(`  ✓ ${this.world.settlements.length} settlements · ${totalPeople} people · ${totalHouseholds} households`);

    if (this.world.settlements.length >= 3) {
      this._spawnBanditFactions();
    }
  }

  _spawnBanditFactions() {
    const rng = this.kernel.rng;
    const factions = this.factions;
    if (!factions) return;

    const banditNames = ['Iron Wolves', 'Black Hawks', 'Blood Reavers', 'Ash Raiders', 'Crow Blades'];
    const memberNames = {
      male: ['Grim', 'Harl', 'Varg', 'Rurik', 'Drago', 'Stark', 'Bren'],
      female: ['Sela', 'Runa', 'Hild', 'Astrid', 'Bryn', 'Kara']
    };

    const created = [];
    for (let i = 0; i < 2; i++) {
      const factionName = banditNames[(rng.nextInt(0, banditNames.length - 1))] + ' of ' + (this.world.settlements[i % this.world.settlements.length].name || 'the Road');
      const founder = this._spawnBandit(this.world.settlements[i % this.world.settlements.length], memberNames, rng);
      if (!founder) continue;

      const result = factions.createFaction(factionName, founder, 'military', { aggressive: 1 });
      if (!result || !result.success) continue;
      const faction = result.faction;
      created.push(faction);

      founder.factionId = faction.id;
      faction.members = [founder.id];
      founder.reputation = -0.5;

      const extra = rng.nextInt(2, 3);
      for (let j = 0; j < extra; j++) {
        const b = this._spawnBandit(this.world.settlements[i % this.world.settlements.length], memberNames, rng);
        if (!b) continue;
        b.factionId = faction.id;
        b.reputation = -0.4 - rng.next() * 0.3;
        faction.members.push(b.id);
      }
      console.log(`    ⚔ Spawned bandit faction "${factionName}" with ${faction.members.length} members (id=${faction.id})`);
    }

    if (created.length === 2) {
      try { factions.startConflict(created[0].id, created[1].id, 'territorial dispute'); } catch (e) {}
    }
  }

  _spawnBandit(settlement, memberNames, rng) {
    try {
      const sex = rng.next() < 0.5 ? 'male' : 'female';
      const name = memberNames[sex][rng.nextInt(0, memberNames[sex].length - 1)];
      const px = settlement.x + rng.nextInt(-6, 6);
      const py = settlement.y + rng.nextInt(-6, 6);
      const person = this.createPerson({
        name: name + ' the Bandit',
        age: rng.nextInt(20, 45),
        sex: sex,
        position: { x: px, y: py, z: 0, settlementId: -1 },
        occupation: 'bandit'
      }, 'active');
      try { person.inventory.add({ type: 'weapon', subtype: 'sword', mass: 1.2, sharpness: 0.7 }); } catch (e) {}
      person.reputation = -0.5;
      return person;
    } catch (e) {
      console.error('[Game._spawnBandit] failed:', e);
      return null;
    }
  }

  createPlayer(name, sex) {
    if (this.player) return { success: false, error: 'Player already exists' };

    const settlement = this.world.settlements[0];
    const household = this.createHousehold(settlement.x, settlement.y, 0);

    const mother = this.createPerson({
      name: this.generateName('female', this.kernel.rng),
      age: 25,
      sex: 'female',
      position: { x: settlement.x, y: settlement.y, z: 0, settlementId: 0 },
      occupation: 'peasant'
    }, 'regional');

    const father = this.createPerson({
      name: this.generateName('male', this.kernel.rng),
      age: 28,
      sex: 'male',
      position: { x: settlement.x, y: settlement.y, z: 0, settlementId: 0 },
      occupation: 'peasant'
    }, 'regional');

    household.addMember(mother.id, 'member');
    household.addMember(father.id, 'head');
    mother.household = household.id;
    father.household = household.id;

    this.kinship.addPerson(mother.id, null, null, 'female');
    this.kinship.addPerson(father.id, null, null, 'male');
    this.kinship.marry(mother.id, father.id);

    const player = this.createPerson({
      name: name,
      age: 0,
      sex: sex,
      position: { x: settlement.x, y: settlement.y, z: 0, settlementId: 0 },
      occupation: 'child',
      isPlayer: true
    }, 'active');

    household.addMember(player.id, 'child');
    player.household = household.id;
    this.kinship.addPerson(player.id, mother.id, father.id, sex);

    this.player = player;
    this.playerHousehold = household;
    this.kernel.setPlayer(player);

    console.log(`  ✓ ${name} born to a peasant family in ${settlement.name}`);

    return { success: true, player, household, settlement };
  }

  /**
   * Create a Person. If `initialTier` is 'regional', the person is added to
   * the regional tier (default) and only ticked every REGIONAL_DEFAULT_INTERVAL
   * minutes — which lets us simulate huge populations without per-tick work.
   * If 'active', they're promoted to active tier immediately.
   */
  createPerson(template, initialTier = 'regional') {
    const person = new Person(this.kernel.nextEntityId++, template, this.kernel);
    person.isPerson = true;
    person.type = 'person';
    person.isPlayer = !!template.isPlayer;

    this.kernel.entities.set(person.id, person);
    if (initialTier === 'active') {
      this.kernel.activeTier.add(person.id);
      this.kernel._setTier(person.id, 0);
      this.kernel.entityIndex.add(person);
    } else {
      this.kernel.entityIndex.add(person);
      // place in regional tier with snapshot materialised
      const snapshot = person.aggregateToRegional();
      this.kernel.regionalTier.set(person.id, {
        snapshot,
        lastUpdate: this.kernel.turn,
        nextUpdate: this.kernel.turn + (snapshot.interval || REGIONAL_DEFAULT_INTERVAL),
        interval: snapshot.interval || REGIONAL_DEFAULT_INTERVAL
      });
      this.kernel._setTier(person.id, 1);
    }

    this.kernel.alivePeople.add(person);
    if (person.sex === 'male') this.kernel.bySex.male.add(person);
    else if (person.sex === 'female') this.kernel.bySex.female.add(person);
    if (template.position && template.position.settlementId !== undefined) {
      const sid = template.position.settlementId;
      let s = this.kernel.bySettlement.get(sid);
      if (!s) { s = new Set(); this.kernel.bySettlement.set(sid, s); }
      s.add(person);
    }
    let typeSet = this.kernel.byType.get('person');
    if (!typeSet) { typeSet = new Set(); this.kernel.byType.set('person', typeSet); }
    typeSet.add(person);
    this.kernel.conservationLedger.population++;
    this.kernel.conservationDirty = true;

    return person;
  }

  createHousehold(x, y, settlementId = 0) {
    const id = this.kernel.nextEntityId++;
    const household = new Household(id, { x, y, z: 0, settlementId });
    household.type = 'household';
    household.isPerson = false;
    household.mass = 0;
    this.kernel.entities.set(id, household);
    let typeSet = this.kernel.byType.get('household');
    if (!typeSet) { typeSet = new Set(); this.kernel.byType.set('household', typeSet); }
    typeSet.add(household);
    return household;
  }

  assignOccupation(age, rng) {
    if (age < 12) return 'child';
    if (age < 18) return 'apprentice';
    const occupations = ['peasant', 'craftsman', 'merchant', 'soldier', 'priest'];
    return occupations[rng.nextInt(0, occupations.length - 1)];
  }

  generateName(sex, rng) {
    const maleNames = ['John', 'William', 'Thomas', 'Robert', 'Richard', 'Henry', 'Edward', 'Geoffrey'];
    const femaleNames = ['Mary', 'Elizabeth', 'Margaret', 'Agnes', 'Alice', 'Joan', 'Emma', 'Catherine'];
    const names = sex === 'male' ? maleNames : femaleNames;
    return names[rng.nextInt(0, names.length - 1)];
  }

  setupEventHandlers() {
this.kernel.on('person_died', (event) => {
      const person = this.kernel.entities.get(event.personId);
      if (!person) return;
      this.notifyUI(`💀 ${person.name} has died at age ${Math.floor(event.age)} from ${event.cause}.`, 'error');
      if (person.household) {
        const household = this.kernel.entities.get(person.household);
        if (household) household.removeMember(person.id);
      }
      // mark dead so indexes stop including them
      this.kernel.alivePeople.delete(person);
      if (person.sex === 'male') this.kernel.bySex.male.delete(person);
      else if (person.sex === 'female') this.kernel.bySex.female.delete(person);
      const sid = person.position && person.position.settlementId;
      if (sid !== undefined) {
        const s = this.kernel.bySettlement.get(sid);
        if (s) s.delete(person);
      }
      this.kernel.activeTier.delete(person.id);
      this.kernel.regionalTier.delete(person.id);
      this.kernel.distantTier.delete(person.id);

      // T5-8: succession on ruler death. If this person was the ruler of any
      // government, attempt heir transfer → election → crisis.
      if (this.politics && typeof this.politics.onRulerDeath === 'function') {
        try {
          this.politics.onRulerDeath(event.personId, { kernel: this.kernel, game: this });
        } catch (e) { /* succession hook failed */ }
      }
    });

    this.kernel.on('player_death', (event) => {
      this.notifyUI('╔═══════════════════════════════════════════════════════════╗\n║                    YOU HAVE DIED                          ║\n╚═══════════════════════════════════════════════════════════╝', 'error');

      const heirs = this.kinship.getEligibleHeirs(event.personId);
      if (heirs.length > 0) {
        this.notifyUI('Eligible heirs:', 'system');
        for (let i = 0; i < heirs.length; i++) {
          const heir = this.kernel.entities.get(heirs[i]);
          if (heir && heir.alive && heir.canSucceed()) {
            this.notifyUI(`  ${i + 1}. ${heir.name} (${heir.age} years, ${heir.occupation})`, 'info');
          }
        }
        this.notifyUI('Use "continue <number>" to play as an heir.', 'system');
      } else {
        this.notifyUI('No eligible heirs. Your lineage ends here. Use "start" to begin a new life.', 'system');
      }
    });
  }

  /**
   * UI notification hook. Each UI calls registerUIListener(logFn) at startup.
   * The Game routes death banners, household warnings, and other system events
   * through this channel so the active UI can render them in its messageLog
   * instead of leaking raw console.log output.
   */
  registerUIListener(fn) {
    if (typeof fn === 'function') this._uiListeners.add(fn);
    return () => this._uiListeners.delete(fn);
  }

  unregisterUIListener(fn) {
    return this._uiListeners.delete(fn);
  }

  notifyUI(message, type = 'system') {
    let delivered = false;
    for (const fn of this._uiListeners) {
      try { fn(message, type); delivered = true; } catch (e) { /* ignore listener errors */ }
    }
    // Fallback to stdout only when no UI is listening (e.g. headless tests).
    if (!delivered) console.log(message);
  }

  notifyUIHouseholdWarning(warning) { this.notifyUI(warning, 'error'); }

  advanceTurns(count = 1) {
    const safeUpdate = (sys, ...args) => {
      if (!sys || typeof sys.update !== 'function') return;
      try { sys.update(...args); } catch (e) { /* system not wired for this signature yet */ }
    };

    for (let i = 0; i < count; i++) {
      // T1-5: auto-feed the player before the kernel ticks so hunger-driven
      // vitality loss doesn't snowball. We try household food first, then
      // personal inventory. T4.6: disabled when `this.autoFeed === false`
      // (hardcore / tutorial-mode).
      if (this.autoFeed && this.player && this.player.alive && this.player.needs?.hunger > 0.7) {
        const player = this.player;
        let consumed = false;

        // 1. Try household food store (covers the player as a member).
        const household = this.playerHousehold || this.kernel.entities.get(player.household);
        if (household && (household.food || 0) > 0) {
          const portion = Math.min(household.food, 5);
          household.food -= portion;
          player.needs.satisfy('hunger', portion * 0.05);
          consumed = true;
        }

        // 2. Fall back to inventory items if household is dry.
        if (!consumed) {
          const inv = player.inventory;
          if (inv && typeof inv.items?.find === 'function') {
            const foodIdx = inv.items.findIndex(i =>
              i && (i.type === 'food' || i.subtype === 'food' || i.nutrition)
            );
            if (foodIdx !== -1) {
              const food = inv.items[foodIdx];
              try { player.physiology.consume(food); } catch (e) { /* food has no calories field */ }
              try { inv.remove(food.type || food.subtype, 1); } catch (e) { inv.items.splice(foodIdx, 1); }
              player.needs.satisfy('hunger', 0.5);
              consumed = true;
            }
          }
        }
      }

      // T1-8: starvation death — if hunger stays critical for >24 game-hours
      // (~1440 turns at 1 min/turn), drain energyStores and eventually kill.
      if (this.player && this.player.alive) {
        const p = this.player;
        if (p.needs?.hunger > 0.95) {
          if (p._hungerCriticalSince < 0) p._hungerCriticalSince = this.kernel.turn;
          const elapsed = this.kernel.turn - p._hungerCriticalSince;
          if (elapsed > 1440) {
            const phys = p.physiology;
            if (phys?.metabolism) {
              phys.metabolism.energyStores = Math.max(0, phys.metabolism.energyStores - 100);
            }
            if (elapsed > 4320 && phys?.anatomy?.torso?.heart?.function !== undefined) {
              // After 3 days critical, start damaging organs.
              phys.anatomy.torso.heart.function = Math.max(0, phys.anatomy.torso.heart.function - 0.001);
              if (phys.anatomy.torso.heart.function <= 0 && p.die) {
                p.die('starvation', this.kernel);
              }
            }
          }
        } else if (p._hungerCriticalSince > 0) {
          // Recovered below threshold — clear the tracker.
          p._hungerCriticalSince = -1;
        }
      }
      const result = this.kernel.tick();

      this.marriage.update(result.turn);
      // TRACK 2: Trading.update expects kernel.worldTime.totalMinutes (game-minute
      // count) so per-day restock cadence lines up with the simulation clock.
      this.trading.update(this.kernel.worldTime?.totalMinutes ?? result.turn);
      this.naturalWorld.update(result.turn);
      safeUpdate(this.flora, this.kernel);
      safeUpdate(this.fauna, this.kernel);
      safeUpdate(this.agriculture, this.kernel);
      safeUpdate(this.buildings, this.kernel);
      safeUpdate(this.settlements, this.kernel, this.kernel);
      safeUpdate(this.infrastructure, this.kernel);
      safeUpdate(this.reputation, this.kernel);
      safeUpdate(this.status);
      safeUpdate(this.npcScheduling);
      safeUpdate(this.religion, this.kernel);
      safeUpdate(this.communication, this.kernel);
      safeUpdate(this.language, this.kernel);
      safeUpdate(this.landOwnership, result.turn);
      safeUpdate(this.ecology, this.kernel);
      safeUpdate(this.markets);
      safeUpdate(this.timeManagement, result.turn, this);
      // Pathogens/outbreaks tick on game time
      if (this.pathogens && typeof this.pathogens.updateOutbreaks === 'function') {
        try { this.pathogens.updateOutbreaks(this.kernel); } catch (e) {}
      }
      // Technology diffusion slow tick (every in-game day = 1440 minutes)
      if (this.technology && this.kernel.turn % 1440 === 0) {
        try { this.technology.diffuse(this.kernel, null, 1); } catch (e) {}
      }

      if (this.player && !this.player.alive) break;

      // Mega-battle ticks: simulate ongoing battles and sieges.
      // One battle round per in-game day (1440 minutes) is realistic.
      if (i % 1440 === 0) {
        for (const battle of this.warfare.getActiveBattles()) {
          try { this.warfare.simulateBattleRound(battle.id); } catch (e) {}
        }
        for (const siege of this.warfare.getActiveSieges()) {
          try { this.warfare.updateSiege(siege.id, 1); } catch (e) {}
        }
      }

      // Politics: rebellions and intrigue drift
      if (i % 1440 === 0) {
        for (const reb of this.politics.getActiveRebellions()) {
          try { this.politics.updateRebellion(reb.id, 1); } catch (e) {}
        }
      }

      // NPC autonomous actions: every in-game hour (60 turns), active NPCs
      // pick a behavior based on occupation, needs, and surroundings.
      if (i % 60 === 0) {
        try { this.npcCoordinator.tick(); } catch (e) {}
      }

      // T3-5: NPC marriage — every in-game month (1440 turns), scan active
      // NPCs and pair up eligible singles with affinity > 0.6.
      if (i % 1440 === 0) {
        try { this._npcMarriageTick(); } catch (e) {}
      }

      // T3-6: NPC reproduction — every in-game month, married couples with
      // household food > 100 and age 18-45 roll for conception. Pregnancies
      // progress via marriage.update(turn) above; giveBirth is called by
      // MarriageSystem.updatePregnancy when the due date is reached.
      if (i % 1440 === 0) {
        try { this._npcReproductionTick(); } catch (e) {}
      }

      // T3-7: NPC criminal behavior — every in-game day, ~2% of desperate
      // NPCs (low reputation OR near-starvation) near a target with food
      // items attempt theft via game.law.attemptTheft.
      if (i % 1440 === 0) {
        try { this._npcCrimeTick(); } catch (e) {}
      }

      // Magic regen + effect expiry
      safeUpdate(this.magic, result.turn);
      // Title/house upkeep
      safeUpdate(this.titles, result.turn);

      // Religion: auto-generate temples/clergy in settlements, answer prayers,
      // generate prophecy, fund temples via tithes.
      if (i % 1440 === 0) {
        safeUpdate(this.religion, result.turn, this);
      }

      // Disease transmission: each turn, infected persons try to spread.
      // Disease itself is naturalistic — pathogens track vector transmission.
      if (this.pathogens?.infections) {
        for (const [infId, inf] of this.pathogens.infections) {
          if (inf?.status === 'resolved') continue;
          try {
            if (typeof this.pathogens.updateInfection === 'function') {
              this.pathogens.updateInfection(infId, this.kernel);
            }
            if (inf && inf.status === 'active') {
              this.pathogens.attemptTransmission(inf, this.pathogens.getDisease(inf.diseaseName), this.kernel);
            }
          } catch (e) {
            console.error('[Game.advanceTurns] pathogens tick failed:', e);
          }
        }
      }

      // Tax collection per in-game day (every settlement government collects).
      if (i % 1440 === 0 && this.politics?.taxes) {
        for (const [, tax] of this.politics.taxes) {
          if (tax.status === 'archived') continue;
          try {
            const gov = this.politics.governments.get(tax.government);
            if (!gov) continue;
            // Subjects = everyone in the governed region
            const subjects = [];
            for (const sid of (gov.subjects || [])) {
              const set = this.kernel.bySettlement?.get?.(sid);
              if (set) for (const p of set) subjects.push(p);
            }
            if (subjects.length > 0) {
              const result = this.politics.collectTax(tax.id, subjects);
              if (result && result.success) {
                const rulerName = (() => {
                  const ruler = gov.ruler ? this.kernel.entities.get(gov.ruler) : null;
                  return ruler ? ruler.name : 'unclaimed';
                })();
                if (result.collected > 0) {
                  this.notifyUI(`💰 ${tax.name} collected ${result.collected.toFixed(1)} (treasury: ${gov.treasury.toFixed(1)}). Ruler: ${rulerName}.`, 'info');
                } else {
                  this.notifyUI(`⚠️  ${tax.name} yielded nothing this cycle (legitimacy: ${(gov.legitimacy * 100).toFixed(0)}%).`, 'warn');
                }
              }
            }
          } catch (e) {}
        }
      }

      // T2-7: per-tick credit work — accrue one day's interest on every
      // active loan, and check for any that just crossed their due date.
      if (i % 1440 === 0 && this.credit) {
        try {
          if (typeof this.credit.accrueAllInterest === 'function') {
            this.credit.accrueAllInterest(24 * 60 * 60 * 1000);
          }
          if (typeof this.credit.checkDefault === 'function') {
            for (const id of this.credit.loans.keys()) {
              try { this.credit.checkDefault(id); } catch (e) {}
            }
          }
        } catch (e) { /* credit not wired for game-day timing yet */ }
      }

      // Weather: regenerate every in-game hour (60 turns).
      if (i % 60 === 0 && this.naturalWorld) {
        try {
          if (typeof this.naturalWorld.updateWeather === 'function') {
            this.naturalWorld.updateWeather(this);
          } else {
            this._generateWeather();
          }
        } catch (e) {}
      }

      // Religion: per-tick clerical activities (bless, proselytize)
      if (i % 60 === 0 && this.religion) {
        try { this._religionTick(); } catch (e) {}
      }

      // Transportation: complete scheduled trips, slight wear on idle vehicles.
      if (i % 60 === 0 && this.transportation) {
        safeUpdate(this.transportation, result.turn);
      }

      if (i % 24 === 0 && this.playerHousehold) {
        const membersCount = this.playerHousehold.members.length;
        const foodNeeded = membersCount * 2;
        if (!this.playerHousehold.consumeFood(foodNeeded)) {
          this.notifyUI('⚠️  Your household is out of food!', 'error');
        }
      }
    }
  }

  /**
   * Player-initiated theft. Wraps Law.attemptTheft with convenience.
   */
  steal(targetPerson, itemIndex = 0) {
    const player = this.player;
    if (!player) return { success: false, reason: 'No player' };
    if (!targetPerson) return { success: false, reason: 'No target' };
    return this.law.attemptTheft(player, targetPerson, itemIndex);
  }

  /**
   * Player accuses another person of a crime. Wraps Law.accusation.
   */
  accuse(accusedPerson, crimeType, evidence = []) {
    const player = this.player;
    if (!player) return { success: false, reason: 'No player' };
    if (!accusedPerson) return { success: false, reason: 'No accused' };
    let law = Array.from(this.law.laws.values()).find(l => l.name.toLowerCase() === crimeType.toLowerCase());
    if (!law) {
      const enacted = this.law.enactLawFromEvent({ type: crimeType, settlementId: player.position?.settlementId });
      law = enacted.law;
    }
    return this.law.accusation(player, accusedPerson, law.id, evidence);
  }

  /**
   * Dynamic law generation triggered by world events (called from elsewhere).
   */
  triggerDynamicLaw(eventType, settlementId = null) {
    return this.law.enactLawFromEvent({ type: eventType, settlementId });
  }

  /**
   * Make Reputation actually affect NPC behavior: NPCs with low reputation
   * for "honest" or "generous" may refuse trades; NPCs with high reputation
   * for "skilled" may offer better prices.
   */
  /**
   * T3-5: NPC marriage tick. For every active unmarried adult, find a same-
   * settlement opposite-sex unmarried adult with whom they have an affinity
   * > 0.6 in Person.relationships. Call game.marriage.propose so the standard
   * affinity / kinship / age checks run.
   *
   * Scoped to `activeTier` so the work scales with on-screen population; the
   * per-marriage.eligible check below gates further so dead/old/young NPCs
   * are skipped.
   */
  _npcMarriageTick() {
    if (!this.kernel?.activeTier || !this.marriage) return;
    const R = this.kernel.rng;
    const eligible = [];
    for (const id of this.kernel.activeTier) {
      if (id === this.player?.id) continue;
      const p = this.kernel.entities.get(id);
      if (!p || !p.alive) continue;
      if (p.age < 18 || p.age > 60) continue;
      if (p.marriage && p.marriage.spouse) continue;
      eligible.push(p);
    }
    if (eligible.length < 2) return;

    // Build buckets per settlement so we only consider co-located partners.
    const bySettlement = new Map();
    for (const p of eligible) {
      const sid = p.position && p.position.settlementId;
      if (sid === undefined) continue;
      if (!bySettlement.has(sid)) bySettlement.set(sid, []);
      bySettlement.get(sid).push(p);
    }

    for (const [, list] of bySettlement) {
      // Shuffle so we don't deterministically pair the first m with the first f.
      for (let i = list.length - 1; i > 0; i--) {
        const j = R.nextInt(0, i);
        const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
      const males = list.filter(p => p.sex === 'male');
      const females = list.filter(p => p.sex === 'female');
      // For each male, walk females in random order and propose to the first
      // one whose affinity > 0.6. Stop once either list is exhausted.
      let fi = 0;
      for (const m of males) {
        if (m.marriage && m.marriage.spouse) continue;
        let target = null;
        for (let k = 0; k < females.length; k++) {
          const f = females[(fi + k) % females.length];
          if (f.marriage && f.marriage.spouse) continue;
          if (f === m) continue;
          const rel = m.relationships && m.relationships.get(f.id);
          if (rel && (rel.affinity || 0) > 0.6) {
            target = f;
            fi = (fi + k + 1) % females.length;
            break;
          }
        }
        if (!target) continue;
        // marriage.propose already enforces kinship + age + affinity; the
        // affinity bar there is 0.7 (proposal threshold) which is stricter
        // than our 0.6 candidate floor — accepted proposals may still
        // fail at roll-time, but the world will keep proposing next month.
        try { this.marriage.propose(m, target); } catch (e) {}
      }
    }
  }

  /**
   * T3-6: NPC reproduction tick. For each married female 18-45 in a household
   * with food > 100, roll once for conception. MarriageSystem.startPregnancy
   * records the pregnancy; marriage.update() drives giveBirth after the
   * pregnancy's dueTurn. We pass a shortened pregnancy length (1 in-game
   * month = 1440 turns) so the test scenarios that run a few thousand turns
   * can actually observe births.
   */
  _npcReproductionTick() {
    if (!this.kernel?.activeTier || !this.marriage) return;
    const R = this.kernel.rng;
    for (const id of this.kernel.activeTier) {
      if (id === this.player?.id) continue;
      const p = this.kernel.entities.get(id);
      if (!p || !p.alive) continue;
      if (p.sex !== 'female') continue;
      if (p.age < 18 || p.age > 45) continue;
      if (!p.marriage || !p.marriage.spouse) continue;
      if (this.marriage.pregnancies && this.marriage.pregnancies.has(p.id)) continue;
      const household = p.household ? this.kernel.entities.get(p.household) : null;
      if (!household || (household.food || 0) <= 100) continue;
      // Don't conceive with the player.
      if (p.marriage.spouse === this.player?.id) continue;
      // Modest per-month conception chance.
      if (R.next() < 0.4) {
        try {
          this.marriage.startPregnancy(p, { pregnancyLengthTurns: 1440 });
        } catch (e) {}
      }
    }
  }

  /**
   * T3-7: NPC crime tick. Active NPCs that are "desperate" (low reputation
   * for honesty OR household food < 20) and have a nearby co-settlement NPC
   * carrying food have a ~2% chance of attempting theft.
   */
  _npcCrimeTick() {
    if (!this.kernel?.activeTier || !this.law) return;
    const R = this.kernel.rng;
    for (const id of this.kernel.activeTier) {
      if (id === this.player?.id) continue;
      const npc = this.kernel.entities.get(id);
      if (!npc || !npc.alive || npc.age < 14) continue;
      if (R.next() >= 0.02) continue;

      // Desperation gate.
      const household = npc.household ? this.kernel.entities.get(npc.household) : null;
      const foodDesperate = household && (household.food || 0) < 20;
      let repDesperate = false;
      try {
        if (this.reputation && this.reputation.getTraitReputation) {
          const honesty = this.reputation.getTraitReputation(npc.id, npc.id, 'honest');
          if (honesty && typeof honesty.value === 'number' && honesty.value < -0.2) repDesperate = true;
        }
      } catch (e) {}
      if (!foodDesperate && !repDesperate) continue;

      // Find a target: nearby co-settlement NPC with food in inventory.
      const pos = npc.position;
      if (!pos) continue;
      const nearIds = this.kernel.queryEntitiesNear ? this.kernel.queryEntitiesNear(pos.x, pos.y, 0, 8) : [];
      let target = null;
      for (const tid of nearIds) {
        if (tid === npc.id) continue;
        const t = this.kernel.entities.get(tid);
        if (!t || !t.alive || !t.isPerson) continue;
        if (t.position && t.position.settlementId !== pos.settlementId) continue;
        const inv = t.inventory && t.inventory.items;
        if (inv && inv.some(i => i && (i.type === 'food' || i.subtype === 'food' || i.nutrition))) {
          target = t;
          break;
        }
      }
      if (!target) continue;

      try { this.law.attemptTheft(npc, target, 0); } catch (e) {}
    }
  }

  reputationAdjustsTrade(npc, player) {
    if (!this.reputation) return 0;
    const community = this.kernel?.bySettlement?.get?.(npc.position?.settlementId ?? 0) || [];
    const rep = this.reputation.getPublicReputation(npc.id, community);
    if (!rep) return 0;
    const honesty = rep.traits?.get('honest')?.value || 0;
    const generosity = rep.traits?.get('generous')?.value || 0;
    // Positive reputation → 5-10% discount; negative → 5-10% markup
    return (honesty + generosity) * 0.1;
  }

  // ─── Weather ────────────────────────────────────────────────────────

  /**
   * Generate current weather based on season, climate, and time-of-year.
   * Mutates naturalWorld.currentWeather with a description string.
   */
  _generateWeather() {
    const wt = this.kernel.worldTime;
    const season = wt.getSeason();
    const month = Math.floor((wt.day - 1) / 30); // 0-11
    const hour = wt.hour;
    const R = this.kernel.rng;

    // Seasonal weather probabilities
    const seasonal = {
      winter: { clear: 0.3, cloudy: 0.25, snow: 0.3, blizzard: 0.05, rain: 0.05, storm: 0.05 },
      spring: { clear: 0.35, cloudy: 0.25, rain: 0.25, storm: 0.1, fog: 0.05 },
      summer: { clear: 0.5, cloudy: 0.2, rain: 0.15, storm: 0.1, drought: 0.05 },
      fall: { clear: 0.3, cloudy: 0.3, rain: 0.2, fog: 0.1, storm: 0.05, snow: 0.05 }
    };
    const probs = seasonal[season] || seasonal.spring;
    let pick = R.next();
    let weather = 'clear';
    for (const [w, p] of Object.entries(probs)) {
      if (pick < p) { weather = w; break; }
      pick -= p;
    }
    // Night → 50% chance of fog unless clear
    if (hour < 6 || hour > 21) {
      if (weather === 'clear' && R.next() < 0.3) weather = 'fog';
    }
    const temp = this._estimateAmbientTemp(season, hour);
    const visibility = { clear: 1, cloudy: 0.8, fog: 0.2, rain: 0.6, storm: 0.4, snow: 0.6, blizzard: 0.1, drought: 1 }[weather] ?? 1;
    if (!this.naturalWorld.weatherHistory) this.naturalWorld.weatherHistory = [];
    this.naturalWorld.currentWeather = {
      condition: weather,
      temperature: temp,
      visibility,
      season,
      month,
      hour,
      generatedAt: this.kernel.turn
    };
    this.naturalWorld.weatherHistory.push({ turn: this.kernel.turn, ...this.naturalWorld.currentWeather });
    if (this.naturalWorld.weatherHistory.length > 200) this.naturalWorld.weatherHistory.shift();
  }

  _estimateAmbientTemp(season, hour) {
    const base = { winter: -2, spring: 12, summer: 22, fall: 8 }[season] ?? 12;
    const diurnal = Math.sin(((hour - 6) / 12) * Math.PI) * 6;
    return Math.round((base + diurnal) * 10) / 10;
  }

  // ─── Religion tick ──────────────────────────────────────────────────

  /**
   * Per-tick religion work: auto-generate a temple + clergy for each
   * settlement if none exists, propagate beliefs, generate prophecy,
   * and let NPC priests bless followers.
   */
  _religionTick() {
    if (!this.religion) return;
    // 1. Ensure each settlement has a temple
    if (!this.religion.temples || this.religion.temples.size === 0) {
      for (let i = 0; i < (this.world?.settlements?.length || 0); i++) {
        const s = this.world.settlements[i];
        if (!s) continue;
        const temple = this.religion.buildTemple({ x: s.x, y: s.y, settlementId: i }, 'small', 0);
        // Auto-ordain a priest: find a person in the settlement
        const set = this.kernel.bySettlement?.get?.(i);
        const candidate = set && [...set].find(p => p.alive && p.age >= 25);
        if (candidate) {
          this.religion.ordainClergy(candidate, 'priest');
          candidate.clergy.temple = temple.id;
          temple.clergy.push(candidate.id);
        }
      }
    }
    // 2. Generate a prophecy occasionally (every ~1000 ticks)
    if (!this.religion._lastProphecy || this.kernel.turn - this.religion._lastProphecy > 1000) {
      if (this.kernel.rng.next() < 0.3) {
        this._generateProphecy();
        this.religion._lastProphecy = this.kernel.turn;
      }
    }
    // 3. T6-2: passive temple morale boost for devout players standing
    //    at a temple tile. Tiny effect so it adds up over a long stay.
    if (this.player && this.player.alive && this.player.faith > 0) {
      const ppos = this.player.position;
      if (ppos && this.religion.temples) {
        for (const t of this.religion.temples.values()) {
          const loc = t.location;
          if (!loc) continue;
          if (Math.abs((loc.x ?? 0) - ppos.x) <= 1 && Math.abs((loc.y ?? 0) - ppos.y) <= 1) {
            this.player.morale = Math.min(1, (this.player.morale || 0.5) + 0.005);
            break;
          }
        }
      }
    }
  }

  /**
   * Generate a vague prophecy from the active clergy. Recorded in
   * Religion.prophecies for players to discover via divination.
   */
  _generateProphecy() {
    if (!this.religion?.clergy) return;
    const clergyList = [...this.religion.clergy.values()];
    if (clergyList.length === 0) return;
    const speaker = clergyList[Math.floor(this.kernel.rng.next() * clergyList.length)];
    const pantheon = this.religion.pantheon;
    const deity = pantheon.deities[0];
const templates = [
      `${deity.name} shall send a ${['sign','plague','harvest','warrior','king'][Math.floor(this.kernel.rng.next()*5)]} before the next turning of the year.`,
      `A great ${['lord','lady','warrior','priest','merchant'][Math.floor(this.kernel.rng.next()*5)]} will rise from humble origins.`,
      `${deity.name} weeps: betrayal in the ${['court','temple','field','hall'][Math.floor(this.kernel.rng.next()*4)]} will bring ruin.`,
      `Three signs shall mark the chosen: ${['fire','water','iron','gold','blood','wheat'][Math.floor(this.kernel.rng.next()*6)]}.`
    ];
    const text = templates[Math.floor(this.kernel.rng.next() * templates.length)];
    if (!this.religion.prophecies) this.religion.prophecies = [];
    this.religion.prophecies.push({
      id: `prophecy_${this.kernel.turn}`,
      text,
      speaker: speaker.personId,
      deityId: deity.id,
      date: this.kernel.turn,
      fulfilled: false
    });
    // Keep only the last 50
    if (this.religion.prophecies.length > 50) this.religion.prophecies.shift();
  }

  /**
   * Get or lazily create a Perception instance for a character.
   * Returns { vision, hearing, smell, attention }.
   */
  getPerceptionFor(person) {
    if (!person || person.id === undefined) return null;
    let cached = this._perceptionCache.get(person.id);
    if (cached) return cached;
    cached = {
      vision: new Vision(person),
      hearing: new Hearing(person),
      smell: new Smell(person),
      attention: new Attention(person)
    };
    this._perceptionCache.set(person.id, cached);
    return cached;
  }

  /**
   * Get or lazily create a Locomotion instance for a character.
   */
  getLocomotionFor(person) {
    if (!person || person.id === undefined) return null;
    let cached = this._locomotionCache.get(person.id);
    if (cached) return cached;
    cached = new Locomotion(person);
    this._locomotionCache.set(person.id, cached);
    return cached;
  }

  getPlayer() { return this.player; }

  /**
   * T2-6: combined wealth summary used by UI status panels.
   * Returns the player's purse (copper/silver/gold), total liquid copper,
   * household wealth, and the regional currency multiplier for the player's
   * settlement. Powers the `Currency: x.xx × copper` display.
   */
  getPlayerWealthSummary() {
    const p = this.player;
    if (!p) return null;
    const purse = p.purse || { copper: 0, silver: 0, gold: 0 };
    const liquidCopper =
      (purse.copper || 0) +
      (purse.silver || 0) * 10 +
      (purse.gold || 0) * 100;
    const hh = p.household ? this.kernel.entities.get(p.household) : null;
    const hhWealth = hh ? (hh.wealth || 0) : 0;
    const sid = p.position?.settlementId ?? 0;
    const mult = this.landOwnership?.regionalCurrency?.get(sid) ?? 1;
    return {
      purse,
      liquidCopper,
      purseWealth: liquidCopper,
      householdWealth: hhWealth,
      settlementId: sid,
      regionalCurrency: mult
    };
  }

  /**
   * T7-6: Best-effort biome alignment for flora/fauna after load.
   *
   * If a save references plants or animals whose (x, y) now resolves to a
   * biome the species can't survive in (desert oak, rainforest wolf, etc.),
   * drop the orphan. Better to lose stale entries than keep logically
   * inconsistent ones — the simulation can always regrow/repopulate them.
   *
   * Returns { plantsRemoved, animalsRemoved } for telemetry.
   */
  _alignNaturalWorldToBiomes() {
    let plantsRemoved = 0;
    let animalsRemoved = 0;

    const getBiome = (x, y) => {
      if (!this.world || typeof this.world.getTile !== 'function') return null;
      const tile = this.world.getTile(x, y);
      return tile && tile.biome ? tile.biome.type : null;
    };

    // Species -> acceptable biomes. Anything not in the list is an orphan.
    const PLANT_BIOMES = {
      oak:   new Set(['forest', 'grassland', 'rainforest']),
      wheat: new Set(['grassland', 'savanna']),
      grass: new Set(['grassland', 'savanna', 'forest', 'tundra']),
      berry: new Set(['forest', 'grassland'])
    };
    const ANIMAL_BIOMES = {
      deer:    new Set(['grassland', 'forest', 'savanna']),
      wolf:    new Set(['forest', 'grassland', 'tundra']),
      rabbit:  new Set(['grassland', 'savanna', 'forest']),
      chicken: new Set(['grassland', 'savanna'])
    };

    if (this.flora && this.flora.plants instanceof Map) {
      for (const [key, plant] of Array.from(this.flora.plants.entries())) {
        const acceptable = PLANT_BIOMES[plant && plant.species];
        if (!acceptable) continue;
        const biome = getBiome(plant.x, plant.y);
        if (!biome || !acceptable.has(biome)) {
          this.flora.plants.delete(key);
          plantsRemoved++;
        }
      }
    }

    if (this.fauna && this.fauna.animals instanceof Map) {
      for (const [id, animal] of Array.from(this.fauna.animals.entries())) {
        const acceptable = ANIMAL_BIOMES[animal && animal.species];
        if (!acceptable) continue;
        const biome = getBiome(Math.floor(animal.x), Math.floor(animal.y));
        if (!biome || !acceptable.has(biome)) {
          this.fauna.animals.delete(id);
          animalsRemoved++;
        }
      }
    }

    return { plantsRemoved, animalsRemoved };
  }

  continueAsHeir(heirIndex) {
    if (!this.player || this.player.alive) return { success: false, error: 'Current character is still alive' };

    const heirs = this.kinship.getEligibleHeirs(this.player.id);
    const validHeirs = heirs.filter(id => {
      const heir = this.kernel.entities.get(id);
      return heir && heir.alive && heir.canSucceed();
    });

    if (heirIndex < 0 || heirIndex >= validHeirs.length) {
      return { success: false, error: 'Invalid heir index' };
    }

    const newPlayer = this.kernel.entities.get(validHeirs[heirIndex]);
    if (!newPlayer) return { success: false, error: 'Heir not found' };

    newPlayer.isPlayer = true;
    this.player = newPlayer;
    this.playerHousehold = this.kernel.entities.get(newPlayer.household);
    this.kernel.setPlayer(newPlayer);
    if (this.kernel.activeTier.has(newPlayer.id) === false) this.kernel.promoteToActive(newPlayer);

    return { success: true, player: newPlayer, household: this.playerHousehold };
  }

  save() {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      seed: this.seed,
      kernel: this.kernel.save(),
      world: {
        seed: this.world.seed,
        settlements: this.world.settlements,
        resources: Array.from(this.world.resources.entries())
      },
      playerId: this.player?.id,
      playerHouseholdId: this.playerHousehold?.id,
      relationships: Array.from(this.relationships.bonds.entries()),
      kinship: Array.from(this.kinship.genealogy.entries()),
      economy: {
        markets: Array.from(this.economy.markets.entries()),
        prices: Array.from(this.economy.prices.entries()),
        trades: this.economy.trades
      },
      marriage: this.marriage.toJSON(),
      trading: this.trading.toJSON(),
      naturalWorld: this.naturalWorld.toJSON(),
      landOwnership: this.landOwnership?.toJSON() || null,
      factions: {
        factions: Array.from(this.factions.factions.entries()),
        alliances: Array.from(this.factions.alliances.entries()),
        conflicts: Array.from(this.factions.conflicts.entries())
      },
      warfare: {
        armies: Array.from(this.warfare.armies.entries()),
        battles: Array.from(this.warfare.battles.entries()),
        sieges: Array.from(this.warfare.sieges.entries())
      },
      politics: {
        governments: Array.from(this.politics.governments.entries()),
        taxes: Array.from(this.politics.taxes.entries())
      },
      credit: {
        loans: Array.from(this.credit.loans.entries()),
        defaults: Array.from(this.credit.defaults.entries())
      },
      pathogens: {
        infections: Array.from((this.pathogens?.infections || new Map()).entries()),
        outbreaks: Array.from((this.pathogens?.outbreaks || new Map()).entries())
      },
      technology: {
        techs: Array.from((this.technology?.technologies || new Map()).entries())
      },
      knowledge: {
        observations: Array.from((this.knowledge?.observations || new Map()).entries()),
        hypotheses: this.knowledge?.hypotheses || []
      },
      language: {
        languages: Array.from((this.language?.languages || new Map()).entries())
      },
      education: {
        institutions: Array.from((this.education?.institutions || new Map()).entries()),
        apprenticeships: Array.from((this.education?.apprenticeships || new Map()).entries())
      },
      markets: {
        markets: Array.from((this.markets?.markets || new Map()).entries()),
        goods: Array.from((this.markets?.goods || new Map()).entries())
      },
      law: {
        laws: Array.from((this.law?.laws || new Map()).entries()),
        cases: Array.from((this.law?.cases || new Map()).entries()),
        courts: Array.from((this.law?.courts || new Map()).entries())
      },
      politicsExtra: {
        coups: this.politics?.coups || [],
        espionage: this.politics?.espionage || []
      },
      factionsExtra: {
        betrayals: this.factions?.betrayals || [],
        schemes: this.factions?.schemes || []
      },
      titles: this.titles?.toJSON() || null,
      magic: this.magic?.toJSON() || null,
      transportation: this.transportation?.toJSON() || null,
      politicsExtra2: {
        elections: this.politics?.elections || [],
        coronations: this.politics?.coronations || [],
        abdications: this.politics?.abdications || [],
        regencies: this.politics?.regencies || [],
        treaties: this.politics?.treaties ? Array.from(this.politics.treaties.entries()) : [],
        councils: this.politics?.councils || [],
        dynasties: this.politics?.dynasties ? Array.from(this.politics.dynasties.entries()) : []
      },
      ecology: this.ecology?.toJSON() || null,
      foodWeb: this.foodWeb?.toJSON() || null,
      buildings: this.buildings?.toJSON() || null,
      settlements: this.settlements?.toJSON() || null,
      infrastructure: this.infrastructure?.toJSON() || null,
      reputation: this.reputation?.toJSON() || null,
      status: this.status?.toJSON() || null,
      npcScheduling: this.npcScheduling?.toJSON() || null,
      religion: this.religion?.toJSON() || null,
      communication: this.communication?.toJSON() || null,
      agriculture: this.agriculture?.toJSON() || null,
      flora: this.flora?.toJSON() || null,
      fauna: this.fauna?.toJSON() || null
    };
  }

  load(saveData) {
    try {
      // T7-1: warn (but don't refuse) if the save's schemaVersion differs from
      // the current loader. Migration is best-effort; older saves still load.
      if (saveData && typeof saveData.schemaVersion === 'number' &&
          saveData.schemaVersion !== SAVE_SCHEMA_VERSION) {
        console.warn(
          `[Game.load] save schemaVersion=${saveData.schemaVersion}, loader=${SAVE_SCHEMA_VERSION}. ` +
          `Loading best-effort; some fields may be missing or reset to defaults.`
        );
      } else if (saveData && saveData.schemaVersion === undefined) {
        console.warn(
          `[Game.load] save has no schemaVersion (legacy v1?). Loading best-effort.`
        );
      }
      this.seed = saveData.seed;
      this.kernel.load(saveData.kernel);

      const worldGen = new WorldGenerator(saveData.world.seed);
      this.world = worldGen.generate();
      this.world.settlements = saveData.world.settlements;
      this.world.resources = new Map(saveData.world.resources);
      if (this.kernel) this.kernel.world = this.world;

      this.player = this.kernel.entities.get(saveData.playerId);
      this.playerHousehold = this.kernel.entities.get(saveData.playerHouseholdId);
      if (this.player) this.kernel.setPlayer(this.player);

      // Migration: ensure every restored Person has the social-state fields
      // introduced in T1-1. Older saves will be missing them.
      for (const entity of this.kernel.entities.values()) {
        if (!entity || !entity.isPerson) continue;
        if (!entity.relationships || !(entity.relationships instanceof Map)) entity.relationships = new Map();
        if (entity.marriage === undefined) entity.marriage = null;
        if (!entity.kinship) entity.kinship = { mother: null, father: null, children: [], siblings: [] };
        if (typeof entity._hungerCriticalSince !== 'number') entity._hungerCriticalSince = -1;
        // Re-link physiology._owner (T1-7) — non-enumerable so JSON roundtrip drops it.
        if (entity.physiology && !entity.physiology._owner) {
          Object.defineProperty(entity.physiology, '_owner', { value: entity, writable: true, enumerable: false, configurable: true });
        }
      }

      // T7-2: restore Person-only fields that JSON.stringify didn't capture
      // by default. Most Person fields are plain enumerable properties and
      // roundtrip via JSON.stringify directly; the ones toJSON/fromJSON is
      // built for are the cases where the value is a non-plain object that
      // needs explicit rehydration (currently memory + relationships Map).
      //
      // We don't *need* toJSON/fromJSON for those because JSON.stringify of
      // a Map emits `{}`, which would lose data — so we rehydrate the saved
      // entity data directly. Person.fromJSON is exposed as a stable hook
      // for future fields that need custom logic.
      const savedById = new Map();
      if (saveData.kernel && Array.isArray(saveData.kernel.entities)) {
        for (const [id, ent] of saveData.kernel.entities) savedById.set(id, ent);
      }
      for (const entity of this.kernel.entities.values()) {
        if (!entity || !entity.isPerson) continue;
        const saved = savedById.get(entity.id);
        if (!saved) continue;
        try {
          if (typeof entity.fromJSON === 'function') entity.fromJSON(saved);
        } catch (e) { /* partial save — ignore */ }
      }

      // T7-3: Inventory.weight is derived from items, but we mutate it
      // directly in add()/remove() so JSON round-trip can leave it stale.
      // Recompute for every Person's inventory after load.
      let inventoryRepaired = 0;
      for (const entity of this.kernel.entities.values()) {
        if (!entity || !entity.isPerson) continue;
        if (entity.inventory && typeof entity.inventory._recomputeWeight === 'function') {
          entity.inventory._recomputeWeight();
          inventoryRepaired++;
        }
      }
      if (inventoryRepaired > 0) {
        // Single line for traceability; not noisy.
        // console.log(`[Game.load] recomputed inventory.weight for ${inventoryRepaired} people`);
      }

      // T7-6: drop flora/fauna entries whose (x, y) now resolves to a biome
      // the species can't survive in. World regen may have shifted biomes.
      // NOTE: real align happens after flora/fauna fromJSON below — the
      // earlier runs saw empty maps. This comment is a marker so future
      // readers don't add another premature call.
      // (No-op here on purpose — see later in this function.)
      if (saveData.relationships) this.relationships.bonds = new Map(saveData.relationships);
      if (saveData.kinship) this.kinship.genealogy = new Map(saveData.kinship);

      if (saveData.economy) {
        this.economy.markets = new Map(saveData.economy.markets);
        this.economy.prices = new Map(saveData.economy.prices);
        this.economy.trades = saveData.economy.trades;
      }

      this.marriage.fromJSON(saveData.marriage);
      this.trading.fromJSON(saveData.trading);
      this.naturalWorld.fromJSON(saveData.naturalWorld);
      this.landOwnership?.fromJSON(saveData.landOwnership);
      if (saveData.factions) {
        this.factions.factions = new Map(saveData.factions.factions || []);
        this.factions.alliances = new Map(saveData.factions.alliances || []);
        this.factions.conflicts = new Map(saveData.factions.conflicts || []);
      }
      if (saveData.warfare) {
        this.warfare.armies = new Map(saveData.warfare.armies || []);
        this.warfare.battles = new Map(saveData.warfare.battles || []);
        this.warfare.sieges = new Map(saveData.warfare.sieges || []);
      }
      if (saveData.politics) {
        this.politics.governments = new Map(saveData.politics.governments || []);
        this.politics.taxes = new Map(saveData.politics.taxes || []);
      }
      if (saveData.credit) {
        this.credit.loans = new Map(saveData.credit.loans || []);
        this.credit.defaults = new Map(saveData.credit.defaults || []);
      }
      if (saveData.pathogens && this.pathogens) {
        if (saveData.pathogens.infections && this.pathogens.infections) {
          this.pathogens.infections = new Map(saveData.pathogens.infections);
        }
        if (saveData.pathogens.outbreaks && this.pathogens.outbreaks) {
          this.pathogens.outbreaks = new Map(saveData.pathogens.outbreaks);
        }
      }
      if (saveData.technology && this.technology?.technologies) {
        this.technology.technologies = new Map(saveData.technology.techs || []);
      }
      if (saveData.knowledge && this.knowledge) {
        this.knowledge.observations = new Map(saveData.knowledge.observations || []);
        this.knowledge.hypotheses = saveData.knowledge.hypotheses || [];
      }
      if (saveData.language && this.language?.languages) {
        this.language.languages = new Map(saveData.language.languages || []);
      }
      if (saveData.education && this.education) {
        if (saveData.education.institutions && this.education.institutions) {
          this.education.institutions = new Map(saveData.education.institutions);
        }
        if (saveData.education.apprenticeships && this.education.apprenticeships) {
          this.education.apprenticeships = new Map(saveData.education.apprenticeships);
        }
      }
      if (saveData.markets && this.markets) {
        if (saveData.markets.markets && this.markets.markets) {
          this.markets.markets = new Map(saveData.markets.markets);
        }
        if (saveData.markets.goods && this.markets.goods) {
          this.markets.goods = new Map(saveData.markets.goods);
        }
      }
      if (saveData.law && this.law) {
        if (this.law.laws) this.law.laws = new Map(saveData.law.laws || []);
        if (this.law.cases) this.law.cases = new Map(saveData.law.cases || []);
        if (this.law.courts) this.law.courts = new Map(saveData.law.courts || []);
      }
      if (saveData.politicsExtra && this.politics) {
        this.politics.coups = saveData.politicsExtra.coups || [];
        this.politics.espionage = saveData.politicsExtra.espionage || [];
      }
      if (saveData.factionsExtra && this.factions) {
        this.factions.betrayals = saveData.factionsExtra.betrayals || [];
        this.factions.schemes = saveData.factionsExtra.schemes || [];
      }
      this.titles?.fromJSON(saveData.titles);
      this.magic?.fromJSON(saveData.magic);
      this.transportation?.fromJSON(saveData.transportation);
      if (saveData.politicsExtra2 && this.politics) {
        this.politics.elections = saveData.politicsExtra2.elections || [];
        this.politics.coronations = saveData.politicsExtra2.coronations || [];
        this.politics.abdications = saveData.politicsExtra2.abdications || [];
        this.politics.regencies = saveData.politicsExtra2.regencies || [];
        this.politics.councils = saveData.politicsExtra2.councils || [];
        this.politics.dynasties = new Map(saveData.politicsExtra2.dynasties || []);
        if (saveData.politicsExtra2.treaties) {
          this.politics.treaties = new Map(saveData.politicsExtra2.treaties);
        }
      }
      this.ecology?.fromJSON(saveData.ecology);
      this.foodWeb?.fromJSON(saveData.foodWeb);
      this.buildings?.fromJSON(saveData.buildings);
      this.settlements?.fromJSON(saveData.settlements);
      this.infrastructure?.fromJSON(saveData.infrastructure);
      this.reputation?.fromJSON(saveData.reputation);
      this.status?.fromJSON(saveData.status);
      this.npcScheduling?.fromJSON(saveData.npcScheduling);
      this.religion?.fromJSON(saveData.religion);
      this.communication?.fromJSON(saveData.communication);
      this.agriculture?.fromJSON(saveData.agriculture);
      this.flora?.fromJSON(saveData.flora);
      this.fauna?.fromJSON(saveData.fauna);

      // T7-6: re-run biome alignment now that flora/fauna are populated.
      // The earlier call at line ~1743 was a no-op because the fresh
      // systems were empty; move the actual alignment to here.
      try {
        const align = this._alignNaturalWorldToBiomes();
        if (align.plantsRemoved > 0 || align.animalsRemoved > 0) {
          // console.log(`[Game.load] pruned ${align.plantsRemoved} plants, ${align.animalsRemoved} animals (biome mismatch)`);
        }
      } catch (e) {
        console.error('[Game.load] biome alignment failed:', e);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getWorldInfo() {
    return {
      turn: this.kernel.turn,
      worldTime: this.kernel.worldTime.toString(),
      season: this.kernel.worldTime.getSeason(),
      timeOfDay: this.kernel.worldTime.getTimeOfDay(),
      population: this.kernel.conservationLedger.population,
      settlements: this.world.settlements.length,
      activeTier: this.kernel.activeTier.size,
      regionalTier: this.kernel.regionalTier.size
    };
  }
}