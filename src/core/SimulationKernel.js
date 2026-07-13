/**
 * SimulationKernel.js
 * Core turn-based simulation engine with efficient state management
 *
 * Design Principles:
 * - Discrete time steps (turns) instead of continuous simulation
 * - Lazy evaluation - only compute what's needed
 * - Spatial partitioning for efficient queries
 * - Event-driven updates to minimize redundant calculations
 * - Deterministic from seed for reproducibility
 */

const EVENT_LOG_CAP = 4096;

export class SimulationKernel {
  /**
   * @param {number} seed  Numeric seed for reproducible runs. When
   *   `seed === undefined` and `SimulationKernel.requiresSeed` is false,
   *   falls back to Date.now() (wall-clock; non-deterministic).
   *   Set `SimulationKernel.requiresSeed = true` for academic/reproducible
   *   runs to throw instead of silently seeding with wall-clock.
   */
  constructor(seed) {
    if (seed === undefined || seed === null) {
      if (SimulationKernel.requiresSeed) {
        throw new Error('SimulationKernel requires an explicit seed (set SimulationKernel.requiresSeed = false to allow Date.now() fallback)'); // AUDIT-WHITELIST: error message text only
      }
      seed = Date.now(); // AUDIT-WHITELIST: seed fallback when not required
    }
    this.seed = seed;
    this.rng = new SeededRNG(seed);
    this.turn = 0;
    this.worldTime = new WorldTime();

    this.entities = new Map();
    this.entityIndex = new SpatialIndex();
    this.nextEntityId = 1;

    this.eventQueue = new PriorityQueue();
    this.eventLog = [];
    this.eventHandlers = new Map();
    this.nextEventCounter = 0;

    this.fidelityTiers = new Uint8Array(1); // 0=active, 1=regional, 2=distant; index = entityId-1
    this.activeTier = new Set();
    this.regionalTier = new Map();
    this.distantTier = new Map();

    // Secondary indexes — rebuilt on createEntity/removeEntity
    this.byType = new Map(); // type -> Set<entity>
    this.bySex = { male: new Set(), female: new Set() };
    this.bySettlement = new Map(); // settlementId -> Set<entity>
    this.alivePeople = new Set();

    this.playerId = null;

    this.conservationLedger = { mass: 0, population: 0, wealth: 0 };
    this.conservationDirty = false;

    this.metrics = { entitiesProcessed: 0, eventsProcessed: 0, turnDuration: 0 };
  }

  setPlayer(entity) {
    this.playerId = entity ? entity.id : null;
  }

  random() { return this.rng.next(); }
  randomInt(min, max) { return this.rng.nextInt(min, max); }
  randomChoice(arr) { return arr[this.rng.nextInt(0, arr.length - 1)]; }

  tick() {
    const startTime = performance.now();
    this.turn++;

    this.processScheduledEvents();
    this.updateActiveTier();
    this.updateRegionalTier();
    this.updateDistantTier();

    this.worldTime.advance(1);

    if (this.conservationDirty) {
      this.conservationDirty = false;
      this.validateConservation();
    }

    this.metrics.turnDuration = performance.now() - startTime;
    this.metrics.entitiesProcessed = this.activeTier.size;

    return { turn: this.turn, worldTime: this.worldTime.toString(), metrics: this.metrics };
  }

  processScheduledEvents() {
    let eventsProcessed = 0;
    while (!this.eventQueue.isEmpty() && this.eventQueue.peek().turn <= this.turn) {
      const event = this.eventQueue.dequeue();
      this.handleEvent(event);
      eventsProcessed++;
      if (eventsProcessed >= 256) break;
    }
    this.metrics.eventsProcessed = eventsProcessed;
  }

  handleEvent(event) {
    this.eventLog.push({ ...event, processedAt: this.turn });
    if (this.eventLog.length > EVENT_LOG_CAP) {
      this.eventLog.splice(0, this.eventLog.length - EVENT_LOG_CAP);
    }
    const handlers = this.eventHandlers.get(event.type);
    if (!handlers) return;
    for (let i = 0; i < handlers.length; i++) handlers[i](event, this);
  }

  scheduleEvent(event, turnsFromNow = 0) {
    this.eventQueue.enqueue({
      ...event,
      turn: this.turn + turnsFromNow,
      id: this.turn * 100000 + (this.nextEventCounter++ & 0xFFFF)
    });
  }

  on(eventType, handler) {
    let handlers = this.eventHandlers.get(eventType);
    if (!handlers) {
      handlers = [];
      this.eventHandlers.set(eventType, handlers);
    }
    handlers.push(handler);
  }

  updateActiveTier() {
    const playerPos = this.playerId !== null ? this.entityLocations(this.playerId) : null;
    const tier = this.fidelityTiers;
    const ents = this.entities;

    for (const entityId of this.activeTier) {
      const entity = ents.get(entityId);
      if (!entity) continue;

      if (playerPos) {
        const loc = this.entityLocations(entityId);
        if (loc) {
          const dx = loc.x - playerPos.x, dy = loc.y - playerPos.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 200 * 200 && tier[entityId - 1] === 0 && !entity._stickyActive) {
            this.demoteToRegional(entity);
            continue;
          }
        }
      }

      if (entity.physiology) {
        const vitals = entity.physiology.update(this);
        if (vitals && vitals.alive === false && entity.alive !== false) {
          if (typeof entity.die === 'function') {
            entity.die(vitals.cause || 'vitals_failure', this);
          } else {
            entity.alive = false;
            this.scheduleEvent({ type: 'person_died', personId: entity.id, cause: vitals.cause || 'vitals_failure', age: entity.age });
          }
        }
      }
      if (entity.alive === false) continue;
      if (entity.needs) entity.needs.update(this);
      if (entity.update) entity.update(this);
    }
  }

  updateRegionalTier() {
    const turn = this.turn;
    for (const [entityId, schedule] of this.regionalTier) {
      if (schedule.nextUpdate > turn) continue;
      const entity = this.entities.get(entityId);
      if (!entity) continue;
      if (entity.updateRegional) {
        entity.updateRegional(this, turn - schedule.lastUpdate);
      }
      schedule.lastUpdate = turn;
      schedule.nextUpdate = turn + schedule.interval;
    }
  }

  updateDistantTier() {
    for (const [, aggregate] of this.distantTier) {
      if (aggregate.updateStatistical) aggregate.updateStatistical(this);
    }
  }

  promoteToActive(entity) {
    if (this.regionalTier.has(entity.id)) {
      const schedule = this.regionalTier.get(entity.id);
      if (entity.materializeFromRegional) entity.materializeFromRegional(schedule.snapshot);
      this.regionalTier.delete(entity.id);
    } else if (this.distantTier.has(entity.id)) {
      if (entity.restoreFromDistant) entity.restoreFromDistant(this.distantTier.get(entity.id).snapshot);
      this.distantTier.delete(entity.id);
    }
    this.activeTier.add(entity.id);
    this._setTier(entity.id, 0);
    this.scheduleEvent({ type: 'fidelity_promoted', entityId: entity.id, tier: 'active' });
  }

  demoteToRegional(entity) {
    const snapshot = entity.aggregateToRegional ? entity.aggregateToRegional() : {};
    this.regionalTier.set(entity.id, {
      snapshot,
      lastUpdate: this.turn,
      nextUpdate: this.turn + (snapshot.interval || 60),
      interval: snapshot.interval || 60
    });
    this.activeTier.delete(entity.id);
    this._setTier(entity.id, 1);
    this.scheduleEvent({ type: 'fidelity_demoted', entityId: entity.id, tier: 'regional' });
  }

  _setTier(entityId, tier) {
    const idx = entityId - 1;
    if (idx >= this.fidelityTiers.length) {
      const grown = new Uint8Array(Math.max(idx + 1, this.fidelityTiers.length * 2));
      grown.set(this.fidelityTiers);
      this.fidelityTiers = grown;
    }
    this.fidelityTiers[idx] = tier;
  }

  getTier(entityId) {
    return this.fidelityTiers[entityId - 1] ?? 0;
  }

  entityLocations(entityId) {
    return this.entityIndex.entityLocations.get(entityId) || null;
  }

  createEntity(template) {
    const id = this.nextEntityId++;
    const entity = new Entity(id, template);
    entity.type = template.type || 'unknown';

    this.entities.set(id, entity);
    this.entityIndex.add(entity);
    this.activeTier.add(id);
    this._setTier(id, 0);

    if (template.position) {
      if (template.position.settlementId !== undefined) {
        let s = this.bySettlement.get(template.position.settlementId);
        if (!s) { s = new Set(); this.bySettlement.set(template.position.settlementId, s); }
        s.add(entity);
      }
    }

    let typeSet = this.byType.get(entity.type);
    if (!typeSet) { typeSet = new Set(); this.byType.set(entity.type, typeSet); }
    typeSet.add(entity);

    if (entity.isPerson) {
      this.alivePeople.add(entity);
      if (entity.sex === 'male') this.bySex.male.add(entity);
      else if (entity.sex === 'female') this.bySex.female.add(entity);
      this.conservationLedger.population++;
      this.conservationDirty = true;
    }
    if (entity.mass) this.conservationLedger.mass += entity.mass;

    this.scheduleEvent({ type: 'entity_created', entityId: id, template: template.type });
    return entity;
  }

  removeEntity(entityId, reason) {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    if (entity.isPerson) {
      this.alivePeople.delete(entity);
      if (entity.sex === 'male') this.bySex.male.delete(entity);
      else if (entity.sex === 'female') this.bySex.female.delete(entity);
      this.conservationLedger.population--;
      this.conservationDirty = true;
    }
    if (entity.mass) this.conservationLedger.mass -= entity.mass;

    this.activeTier.delete(entityId);
    this.regionalTier.delete(entityId);
    this.distantTier.delete(entityId);
    this.entityIndex.remove(entity);

    const typeSet = this.byType.get(entity.type);
    if (typeSet) typeSet.delete(entity);

    if (entity.position && entity.position.settlementId !== undefined) {
      const s = this.bySettlement.get(entity.position.settlementId);
      if (s) s.delete(entity);
    }

    entity.tombstone = { removedAt: this.turn, reason };
    this.scheduleEvent({ type: 'entity_removed', entityId, reason });
  }

  queryEntitiesNear(x, y, z, radius) {
    return this.entityIndex.queryRadius(x, y, z, radius);
  }

  queryEntitiesByType(type) {
    const set = this.byType.get(type);
    if (!set) return [];
    const out = [];
    for (const e of set) if (!e.tombstone) out.push(e);
    return out;
  }

  getPlayerEntity() {
    if (this.playerId === null) return null;
    return this.entities.get(this.playerId) || null;
  }

  validateConservation() {
    let actualPop = 0;
    let actualMass = 0;
    for (const entity of this.entities.values()) {
      if (entity.tombstone) continue;
      if (entity.isPerson) actualPop++;
      if (entity.mass) actualMass += entity.mass;
    }
    const popDrift = Math.abs(actualPop - this.conservationLedger.population);
    const massDrift = Math.abs(actualMass - this.conservationLedger.mass);
    if (popDrift > 0 || massDrift > 0.01) {
      this.conservationLedger.population = actualPop;
      this.conservationLedger.mass = actualMass;
    }
  }

  save() {
    return {
      seed: this.seed,
      turn: this.turn,
      worldTime: this.worldTime.save(),
      entities: Array.from(this.entities.entries()),
      eventLog: this.eventLog,
      conservationLedger: this.conservationLedger,
      activeTier: Array.from(this.activeTier),
      regionalTier: Array.from(this.regionalTier.entries()),
      distantTier: Array.from(this.distantTier.entries())
    };
  }

  load(saveData) {
    this.seed = saveData.seed;
    this.turn = saveData.turn;
    this.worldTime.load(saveData.worldTime);
    this.entities = new Map(saveData.entities);
    this.eventLog = saveData.eventLog;
    this.conservationLedger = saveData.conservationLedger;
    this.activeTier = new Set(saveData.activeTier);
    this.regionalTier = new Map(saveData.regionalTier);
    this.distantTier = new Map(saveData.distantTier);

    this.byType.clear();
    this.bySex.male.clear();
    this.bySex.female.clear();
    this.bySettlement.clear();
    this.alivePeople.clear();

    this.entityIndex.clear();
    for (const entity of this.entities.values()) {
      if (!entity.tombstone) this.entityIndex.add(entity);
      let typeSet = this.byType.get(entity.type);
      if (!typeSet) { typeSet = new Set(); this.byType.set(entity.type, typeSet); }
      typeSet.add(entity);
      if (entity.isPerson) {
        this.alivePeople.add(entity);
        if (entity.sex === 'male') this.bySex.male.add(entity);
        else if (entity.sex === 'female') this.bySex.female.add(entity);
        const sid = entity.position && entity.position.settlementId;
        if (sid !== undefined) {
          let s = this.bySettlement.get(sid);
          if (!s) { s = new Set(); this.bySettlement.set(sid, s); }
          s.add(entity);
        }
      }
    }

    for (const id of this.activeTier) this._setTier(id, 0);
    for (const id of this.regionalTier.keys()) this._setTier(id, 1);
    for (const id of this.distantTier.keys()) this._setTier(id, 2);
  }
}

/**
 * Seeded RNG — Mulberry32: faster + better quality than the LCG it replaces.
 */
class SeededRNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed || 1;
  }
  next() {
    let t = (this.state = (this.state + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
  nextGaussian(mean = 0, stdDev = 1) {
    let u1 = this.next(), u2 = this.next();
    if (u1 < 1e-9) u1 = 1e-9;
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev + mean;
  }
  choice(array) { return array[Math.floor(this.next() * array.length)]; }
}

/**
 * World time tracking with calendar
 */
class WorldTime {
  constructor() {
    this.year = 1;
    this.day = 1;
    this.hour = 6;
    this.minute = 0;
    this.totalMinutes = 0;
  }
  advance(minutes = 60) {
    this.minute += minutes;
    this.totalMinutes += minutes;
    while (this.minute >= 60) { this.minute -= 60; this.hour++; }
    while (this.hour >= 24) { this.hour -= 24; this.day++; }
    while (this.day > 365) { this.day -= 365; this.year++; }
  }
  getSeason() {
    if (this.day < 91) return 'winter';
    if (this.day < 182) return 'spring';
    if (this.day < 274) return 'summer';
    return 'fall';
  }
  getTimeOfDay() {
    if (this.hour < 6) return 'night';
    if (this.hour < 12) return 'morning';
    if (this.hour < 18) return 'afternoon';
    return 'evening';
  }
  toString() {
    return `Year ${this.year}, Day ${this.day}, ${String(this.hour).padStart(2,'0')}:${String(this.minute).padStart(2,'0')}`;
  }
  save() { return { year: this.year, day: this.day, hour: this.hour, minute: this.minute, totalMinutes: this.totalMinutes }; }
  load(d) { this.year=d.year; this.day=d.day; this.hour=d.hour; this.minute=d.minute; this.totalMinutes=d.totalMinutes; }
}

/**
 * Binary heap priority queue — O(log n) insert / extract.
 */
class PriorityQueue {
  constructor() { this.items = []; }
  _cmp(a, b) { return a.turn - b.turn; }
  enqueue(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].turn <= items[i].turn) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  dequeue() {
    const items = this.items;
    if (items.length === 0) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let smallest = i;
        if (l < n && items[l].turn < items[smallest].turn) smallest = l;
        if (r < n && items[r].turn < items[smallest].turn) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }
  peek() { return this.items[0] || null; }
  isEmpty() { return this.items.length === 0; }
  size() { return this.items.length; }
}

/**
 * Spatial index with numeric 64-bit cell keys and squared-distance queries.
 * No string allocation per cell. Default cellSize = 16 tuned for radius-10
 * "nearby" queries so we sweep only the directly adjacent cells.
 */
class SpatialIndex {
  constructor(cellSize = 16) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
    this.entityLocations = new Map();
  }
  add(entity) {
    if (!entity.position) return;
    const key = this._key(entity.position.x, entity.position.y, entity.position.z || 0);
    let cell = this.cells.get(key);
    if (!cell) { cell = []; this.cells.set(key, cell); }
    cell.push(entity.id);
    this.entityLocations.set(entity.id, { x: entity.position.x, y: entity.position.y, z: entity.position.z || 0 });
  }
  remove(entity) {
    const loc = this.entityLocations.get(entity.id);
    if (!loc) return;
    const key = this._key(loc.x, loc.y, loc.z);
    const cell = this.cells.get(key);
    if (cell) {
      const idx = cell.indexOf(entity.id);
      if (idx !== -1) {
        const last = cell.pop();
        if (idx < cell.length) cell[idx] = last;
        if (cell.length === 0) this.cells.delete(key);
      }
    }
    this.entityLocations.delete(entity.id);
  }
  update(entity) {
    this.remove(entity);
    this.add(entity);
  }
  queryRadius(x, y, z, radius) {
    const r2 = radius * radius;
    const cs = this.cellSize;
    const minX = Math.floor((x - radius) * this.invCellSize);
    const maxX = Math.floor((x + radius) * this.invCellSize);
    const minY = Math.floor((y - radius) * this.invCellSize);
    const maxY = Math.floor((y + radius) * this.invCellSize);
    const results = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this._rawKey(cx, cy, 0));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const id = cell[i];
          const loc = this.entityLocations.get(id);
          if (!loc) continue;
          const dx = loc.x - x, dy = loc.y - y;
          if (dx * dx + dy * dy <= r2) results.push(id);
        }
      }
    }
    return results;
  }
  distance(entityId1, entityId2) {
    const a = this.entityLocations.get(entityId1);
    const b = this.entityLocations.get(entityId2);
    if (!a || !b) return Infinity;
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  distanceSq(entityId1, entityId2) {
    const a = this.entityLocations.get(entityId1);
    const b = this.entityLocations.get(entityId2);
    if (!a || !b) return Infinity;
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }
  _rawKey(cx, cy, cz) {
    // 21 bits per axis = ±1,048,576 cells per axis; cellSize 16 → ±16,777,216 world units
    return (cx + 1048576) | ((cy + 1048576) << 21) | ((cz & 0x1FF) << 42);
  }
  _key(x, y, z) {
    return this._rawKey(Math.floor(x * this.invCellSize), Math.floor(y * this.invCellSize), z);
  }
  clear() { this.cells.clear(); this.entityLocations.clear(); }
}

/**
 * Base entity class.
 */
class Entity {
  constructor(id, template) {
    this.id = id;
    this.type = template.type || 'unknown';
    this.position = template.position || { x: 0, y: 0, z: 0 };
    this.mass = template.mass || 0;
    this.isPerson = !!template.isPerson;
    this.isPlayer = !!template.isPlayer;
    this.tombstone = null;

    this.physiology = null;
    this.needs = null;
    this.ai = null;
    this.inventory = null;
    this.relationships = null;
    this.update = null;
    this.updateRegional = null;
    this.materializeFromRegional = null;
    this.aggregateToRegional = null;
  }
}

SimulationKernel.requiresSeed = false;

export { SeededRNG, WorldTime, PriorityQueue, SpatialIndex, Entity };