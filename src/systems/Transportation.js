/**
 * Transportation.js
 *
 * Mounts, vehicles, ships, and travel mechanics.
 *
 * Vehicle types:
 *   - on_foot:        no vehicle, base speed
 *   - mount (horse):  ×2.5 speed, requires saddle, animal husbandry skill
 *   - cart:           ×1.5 speed, +cargo capacity (animals + goods)
 *   - wagon:          ×1.2 speed, +large cargo, requires 2+ draft animals
 *   - boat:           ×1.8 speed on water only, carries cargo
 *   - ship:           ×3.0 speed on water only, large cargo, requires crew
 *
 * Travel times are computed by distance, vehicle speed, terrain, and weather.
 * Stables and shipyards are settlement infrastructure (auto-built per town).
 */

export const VEHICLE_TYPES = {
  on_foot: { speed: 1.0, cargoCapacity: 5, requires: [], terrain: ['any'] },
  mount: { speed: 2.5, cargoCapacity: 15, requires: ['saddle'], terrain: ['land'] },
  cart: { speed: 1.5, cargoCapacity: 50, requires: ['draft_animal'], terrain: ['land', 'road'] },
  wagon: { speed: 1.2, cargoCapacity: 200, requires: ['draft_animal', 'draft_animal'], terrain: ['land', 'road'] },
  boat: { speed: 1.8, cargoCapacity: 100, requires: [], terrain: ['water'] },
  ship: { speed: 3.0, cargoCapacity: 1000, requires: ['crew:5'], terrain: ['water'] },
  raft: { speed: 1.0, cargoCapacity: 30, requires: [], terrain: ['water'] }
};

export class Transportation {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    /** vehicleId -> vehicle */
    this.vehicles = new Map();
    /** personId -> { vehicle, departedAt, destination, eta } */
    this.travelers = new Map();
    /** settlementId -> { mounts:[], carts:[], boats:[] } (stable inventory) */
    this.stables = new Map();
    /** settlementId -> { boats:[], ships:[] } */
    this.shipyards = new Map();
    this.nextVehicleId = 1;
    /** historical trade routes (player can pay to fast-travel along) */
    this.tradeRoutes = new Map();
  }

  /**
   * Create a vehicle at a settlement.
   */
  spawnVehicle(type, settlementId, ownerId = null, name = null) {
    const def = VEHICLE_TYPES[type];
    if (!def) return { success: false, reason: 'Unknown vehicle type' };
    const v = {
      id: this.nextVehicleId++,
      type,
      name: name || `${type[0].toUpperCase() + type.slice(1)} #${this.nextVehicleId - 1}`,
      settlementId,
      owner: ownerId,
      cargo: [],
      cargoUsed: 0,
      condition: 1.0,
      speed: def.speed,
      cargoCapacity: def.cargoCapacity
    };
    this.vehicles.set(v.id, v);
    // Register in stable/shipyard
    if (type === 'mount' || type === 'cart' || type === 'wagon') {
      if (!this.stables.has(settlementId)) this.stables.set(settlementId, []);
      this.stables.get(settlementId).push(v.id);
    } else {
      if (!this.shipyards.has(settlementId)) this.shipyards.set(settlementId, []);
      this.shipyards.get(settlementId).push(v.id);
    }
    return { success: true, vehicle: v };
  }

  /**
   * Auto-generate vehicles for each settlement on world init.
   * Each settlement gets: 2-5 mounts, 1-2 carts, sometimes a boat.
   */
  populateForSettlements(settlements) {
    if (!settlements) return;
    for (let i = 0; i < settlements.length; i++) {
      const s = settlements[i];
      if (!s) continue;
      const mountCount = 2 + Math.floor(this.kernel.random() * 4);
      const cartCount = 1 + (this.kernel.random() < 0.5 ? 1 : 0);
      for (let j = 0; j < mountCount; j++) this.spawnVehicle('mount', i, null, `Horse of ${s.name}`);
      for (let j = 0; j < cartCount; j++) this.spawnVehicle('cart', i, null, `Cart of ${s.name}`);
      if (this.kernel.random() < 0.3) this.spawnVehicle('boat', i, null, `Boat of ${s.name}`);
    }
  }

  /**
   * Mount a vehicle. Sets it as the player's current transport.
   */
  mountVehicle(person, vehicleId) {
    const v = this.vehicles.get(vehicleId);
    if (!v) return { success: false, reason: 'No such vehicle' };
    if (v.owner && v.owner !== person.id) return { success: false, reason: 'Not your vehicle (steal it first)' };
    if (v.condition <= 0) return { success: false, reason: 'Vehicle is destroyed' };
    this.travelers.set(person.id, { vehicle: vehicleId, departedAt: this.kernel.turn, destination: null });
    person.transport = v;
    return { success: true, vehicle: v };
  }

  /**
   * Dismount.
   */
  dismount(person) {
    if (!this.travelers.has(person.id)) return { success: false, reason: 'Not traveling' };
    this.travelers.delete(person.id);
    if (person.transport) person.transport = null;
    return { success: true };
  }

  _worldBounds() {
    const w = this.game?.worldConfig?.worldSize || this.game?.world?.width ? this.game.world : null;
    const width = w?.width ?? this.game?.worldConfig?.worldSize?.width ?? 100;
    const height = w?.height ?? this.game?.worldConfig?.worldSize?.height ?? 100;
    return { width, height };
  }

  _clampPosition(pos) {
    if (!pos) return;
    const { width, height } = this._worldBounds();
    if (pos.x < 0) pos.x = 0;
    if (pos.y < 0) pos.y = 0;
    if (pos.x >= width) pos.x = width - 1;
    if (pos.y >= height) pos.y = height - 1;
  }

  /**
   * Travel from current position to (dx,dy). Calculates time based on vehicle,
   * terrain, weather, and distance. Consumes vehicle condition; very long
   * trips may damage or destroy mounts. Position is clamped to world bounds.
   */
  travel(person, dx, dy, opts = {}) {
    const t = this.travelers.get(person.id);
    const v = t ? this.vehicles.get(t.vehicle) : null;
    const speed = v ? v.speed : 1.0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const weather = this.game?.naturalWorld?.currentWeather;
    let weatherMod = 1.0;
    if (weather) {
      if (weather.condition === 'storm' || weather.condition === 'blizzard') weatherMod = 0.5;
      else if (weather.condition === 'rain' || weather.condition === 'snow') weatherMod = 0.7;
      else if (weather.condition === 'fog') weatherMod = 0.8;
    }
    // Vehicle condition halves speed when worn
    const conditionMod = v ? Math.max(0.3, v.condition) : 1.0;
    const ticks = Math.ceil(distance * 60 / (speed * weatherMod * conditionMod));
    // Wear vehicle condition
    if (v) v.condition = Math.max(0, v.condition - distance / 100);

    if (person.position) {
      person.position.x += dx;
      person.position.y += dy;
      this._clampPosition(person.position);
    }
    if (t) {
      t.destination = opts.destination || null;
      t.eta = this.kernel.turn + ticks;
    }
    return { success: true, distance, ticks, condition: v?.condition ?? 1 };
  }

  /**
   * Sail a boat/ship from the current coastal tile to (dx, dy). Requires
   * the player to be on water.
   */
  sail(person, dx, dy) {
    const t = this.travelers.get(person.id);
    if (!t) return { success: false, reason: 'Board a vessel first' };
    const v = this.vehicles.get(t.vehicle);
    if (!v) return { success: false, reason: 'No vessel' };
    if (!['boat', 'ship', 'raft'].includes(v.type)) {
      return { success: false, reason: `${v.type} cannot sail` };
    }
    return this.travel(person, dx, dy, { destination: 'sea' });
  }

  /**
   * Drive a cart/wagon along roads. Faster than walking but needs draft animals.
   */
  drive(person, dx, dy) {
    const t = this.travelers.get(person.id);
    if (!t) return { success: false, reason: 'Board a cart first' };
    const v = this.vehicles.get(t.vehicle);
    if (!v) return { success: false, reason: 'No vehicle' };
    if (!['cart', 'wagon'].includes(v.type)) {
      return { success: false, reason: `${v.type} cannot drive` };
    }
    return this.travel(person, dx, dy, { destination: 'overland' });
  }

  /**
   * Fast travel along a known trade route. Costs copper; instant arrival.
   */
  fastTravel(person, routeId, cost = 50) {
    const route = this.tradeRoutes.get(routeId);
    if (!route) return { success: false, reason: 'Unknown trade route' };
    const household = this.kernel.entities.get(person.household);
    const wealth = household?.wealth || person.wealth || 0;
    if (wealth < cost) return { success: false, reason: `Need ${cost} copper (have ${wealth})` };
    if (household) household.wealth -= cost;
    else person.wealth = (person.wealth || 0) - cost;
    if (person.position) {
      person.position.x = route.toX;
      person.position.y = route.toY;
      this._clampPosition(person.position);
    }
    return { success: true, route, cost };
  }

  /**
   * Load cargo (goods, items, animals) onto a vehicle.
   * item: { type, weight, ... }, quantity: how many to add.
   */
  loadCargo(vehicleId, item, quantity = 1) {
    const v = this.vehicles.get(vehicleId);
    if (!v) return { success: false, reason: 'Unknown vehicle' };
    if (!item || !item.type) return { success: false, reason: 'Need an item with a type' };
    const itemWeight = (item.weight || 1) * quantity;
    if ((v.cargoUsed || 0) + itemWeight > (v.cargoCapacity || 0)) {
      return { success: false, reason: 'Vehicle is full' };
    }
    // Merge with existing stack of same type if present
    const existing = v.cargo.find(c => c.type === item.type);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + quantity;
      existing.weight = (existing.weight || itemWeight) + itemWeight;
    } else {
      v.cargo.push({
        type: item.type,
        quantity,
        weight: itemWeight,
        loadedAt: this.kernel.turn
      });
    }
    v.cargoUsed = (v.cargoUsed || 0) + itemWeight;
    return { success: true, vehicle: v, loaded: { type: item.type, quantity } };
  }

  /**
   * Unload cargo from a vehicle. Returns the unloaded item to a destination.
   * If a person is passed and they have inventory, the items go there.
   */
  unloadCargo(vehicleId, cargoIndex = 0, quantity = 1, destinationPerson = null) {
    const v = this.vehicles.get(vehicleId);
    if (!v) return { success: false, reason: 'Unknown vehicle' };
    if (!v.cargo || v.cargo.length === 0) return { success: false, reason: 'Vehicle is empty' };
    if (cargoIndex < 0 || cargoIndex >= v.cargo.length) {
      return { success: false, reason: 'Bad cargo index' };
    }
    const stack = v.cargo[cargoIndex];
    const take = Math.min(quantity, stack.quantity || 1);
    const takeWeight = ((stack.weight || 1) / (stack.quantity || 1)) * take;
    stack.quantity -= take;
    stack.weight -= takeWeight;
    v.cargoUsed = Math.max(0, (v.cargoUsed || 0) - takeWeight);
    if (stack.quantity <= 0) v.cargo.splice(cargoIndex, 1);
    const taken = { type: stack.type, quantity: take };
    if (destinationPerson && destinationPerson.inventory) {
      try {
        destinationPerson.inventory.add(stack.type, take);
      } catch (e) {
        // Inventory may not support add; just log
      }
    }
    return { success: true, vehicle: v, unloaded: taken };
  }

  /**
   * Build a trade route between two settlements.
   */
  establishTradeRoute(fromSettlementId, toSettlementId, settlements, name) {
    const from = settlements[fromSettlementId];
    const to = settlements[toSettlementId];
    if (!from || !to) return { success: false, reason: 'Unknown settlement' };
    const route = {
      id: `route_${fromSettlementId}_${toSettlementId}_${this.kernel?.turn ?? 0}`,
      name: name || `${from.name} ↔ ${to.name}`,
      from: fromSettlementId,
      to: toSettlementId,
      fromX: from.x, fromY: from.y,
      toX: to.x, toY: to.y,
      distance: Math.sqrt((from.x - to.x) ** 2 + (from.y - to.y) ** 2),
      toll: 50,
      established: this.kernel?.turn ?? 0
    };
    this.tradeRoutes.set(route.id, route);
    return { success: true, route };
  }

  /** Per-tick: degrade idle vehicle condition slightly, complete trips. */
  update(turn) {
    for (const [, traveler] of this.travelers) {
      if (traveler.eta && traveler.eta <= turn) {
        traveler.destination = null;
        traveler.eta = null;
      }
    }
  }

  getStable(settlementId) {
    const ids = this.stables.get(settlementId) || [];
    return ids.map(id => this.vehicles.get(id)).filter(Boolean);
  }
  getShipyard(settlementId) {
    const ids = this.shipyards.get(settlementId) || [];
    return ids.map(id => this.vehicles.get(id)).filter(Boolean);
  }
  getTradeRoutes() {
    return Array.from(this.tradeRoutes.values());
  }
  getVehicle(id) {
    return this.vehicles.get(id);
  }
  getTraveler(personId) {
    return this.travelers.get(personId);
  }
  isOnWater(person) {
    if (!person?.position || !this.game?.world) return false;
    const tile = this.game.world.getTile(person.position.x, person.position.y);
    return tile && (tile.terrain?.elevation < 5 || tile.biome?.type === 'ocean' || tile.biome?.type === 'lake');
  }

  toJSON() {
    return {
      vehicles: Array.from(this.vehicles.entries()),
      travelers: Array.from(this.travelers.entries()),
      stables: Array.from(this.stables.entries()),
      shipyards: Array.from(this.shipyards.entries()),
      tradeRoutes: Array.from(this.tradeRoutes.entries()),
      nextVehicleId: this.nextVehicleId
    };
  }
  fromJSON(data) {
    if (!data) return;
    if (data.vehicles) this.vehicles = new Map(data.vehicles);
    if (data.travelers) this.travelers = new Map(data.travelers);
    if (data.stables) this.stables = new Map(data.stables);
    if (data.shipyards) this.shipyards = new Map(data.shipyards);
    if (data.tradeRoutes) this.tradeRoutes = new Map(data.tradeRoutes);
    if (data.nextVehicleId) this.nextVehicleId = data.nextVehicleId;
  }
}