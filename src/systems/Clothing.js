/**
 * Clothing.js
 * Medieval clothing system: layered garments, materials, insulation,
 * wetness, exposure, and per-tick degradation/weather response.
 *
 * Design:
 * - Each person wears 0..N layers stored in `person.clothing.layers` keyed by
 *   equipment slot (`head`/`torso`/`legs`/`arms`/`hands`/`feet`/`outerwear`).
 * - Layers degrade on every tick from wear, get wet in rain, dry in sun.
 * - Effective insulation is the sum of (materialInsulation * thickness * condition)
 *   across all worn layers, scaled by per-layer wetness (wet = up to -50%).
 * - `update()` is throttled to once per game-hour (60 turns) so we match the
 *   orchestrator's per-tick cadence without doing per-tick work.
 * - All randomness flows through `kernel.rng.next()` so the simulation stays
 *   deterministic from a seed.
 */

const TICK_INTERVAL = 60; // once per game-hour (turns)

const SLOTS = ['head', 'torso', 'legs', 'arms', 'hands', 'feet', 'outerwear'];

const MATERIAL_PROPERTIES = {
  linen:  { insulation: 0.20, waterResistance: 0.10, weight: 0.3, durability: 0.6 },
  wool:   { insulation: 0.45, waterResistance: 0.40, weight: 0.6, durability: 0.7 },
  leather:{ insulation: 0.50, waterResistance: 0.65, weight: 1.2, durability: 0.9 },
  mail:   { insulation: 0.55, waterResistance: 0.30, weight: 4.0, durability: 0.95 },
  plate:  { insulation: 0.60, waterResistance: 0.85, weight: 9.0, durability: 0.99 }
};

const LAYER_TYPE_TO_SLOT = {
  undergarment: 'torso',
  tunic: 'torso',
  gambeson: 'torso',
  leather: 'torso',
  mail: 'torso',
  plate: 'torso',
  cloak: 'outerwear',
  hood: 'head',
  hat: 'head',
  gloves: 'hands',
  boots: 'feet'
};

export class Clothing {
  constructor(kernel, game) {
    this.kernel = kernel;
    this.game = game;
    this.lastUpdateTurn = -Infinity;
  }

  update(kernel) {
    if (!kernel) return;
    const turn = kernel.turn;
    if (turn - this.lastUpdateTurn < TICK_INTERVAL) return;
    this.lastUpdateTurn = turn;

    const people = this._allPeople();
    for (const person of people) {
      const layers = person.clothing && person.clothing.layers;
      if (!layers) continue;
      for (const slot of SLOTS) {
        const arr = layers[slot];
        if (!arr || arr.length === 0) continue;
        for (const layer of arr) {
          this._decayLayer(layer, kernel);
          this._dryLayer(layer, kernel);
        }
      }
    }
  }

  equip(person, slot, layer) {
    if (!person || !SLOTS.includes(slot) || !layer || !layer.type) {
      return { success: false, insulationDelta: 0 };
    }
    const expectedSlot = LAYER_TYPE_TO_SLOT[layer.type];
    if (expectedSlot && expectedSlot !== slot) {
      return { success: false, insulationDelta: 0, reason: `type ${layer.type} goes to ${expectedSlot}` };
    }
    const material = MATERIAL_PROPERTIES[layer.material];
    if (!material) {
      return { success: false, insulationDelta: 0, reason: `unknown material ${layer.material}` };
    }
    const before = this.getInsulation(person);
    if (!person.clothing) person.clothing = { layers: {} };
    if (!person.clothing.layers) person.clothing.layers = {};
    if (!person.clothing.layers[slot]) person.clothing.layers[slot] = [];

    const stored = this._normalizeLayer(layer);
    this._applyWetnessDecay(stored);
    person.clothing.layers[slot].push(stored);
    const after = this.getInsulation(person);
    return { success: true, insulationDelta: after - before, layer: stored };
  }

  unequip(person, slot) {
    if (!person || !person.clothing || !person.clothing.layers) return null;
    const arr = person.clothing.layers[slot];
    if (!arr || arr.length === 0) return null;
    const idx = arr.length - 1;
    const removed = arr.splice(idx, 1)[0];
    if (arr.length === 0) delete person.clothing.layers[slot];
    return removed || null;
  }

  getInsulation(person) {
    if (!person || !person.clothing || !person.clothing.layers) return 0;
    let total = 0;
    for (const slot of SLOTS) {
      const arr = person.clothing.layers[slot];
      if (!arr) continue;
      for (const layer of arr) {
        total += this._layerEffectiveInsulation(layer);
      }
    }
    if (total > 1) total = 1;
    if (total < 0) total = 0;
    return total;
  }

  getExposure(person) {
    const empty = { head: true, hands: true, feet: true, torso: true };
    if (!person || !person.clothing || !person.clothing.layers) return empty;
    const layers = person.clothing.layers;
    if ((layers.head || []).length > 0) empty.head = false;
    if ((layers.hands || []).length > 0) empty.hands = false;
    if ((layers.feet || []).length > 0) empty.feet = false;
    if ((layers.torso || []).length > 0) empty.torso = false;
    return empty;
  }

  damage(person, slot, amount) {
    if (!person || !person.clothing || !person.clothing.layers) return null;
    const arr = person.clothing.layers[slot];
    if (!arr || arr.length === 0) return null;
    let damageAmount = Number(amount);
    if (!isFinite(damageAmount) || damageAmount <= 0) return null;
    const target = arr[arr.length - 1];
    target.condition -= damageAmount;
    if (target.condition < 0) target.condition = 0;
    return target;
  }

  getWetness(person) {
    if (!person || !person.clothing || !person.clothing.layers) return 0;
    let sum = 0;
    let count = 0;
    for (const slot of SLOTS) {
      const arr = person.clothing.layers[slot];
      if (!arr) continue;
      for (const layer of arr) {
        sum += (layer.wetness || 0);
        count++;
      }
    }
    if (count === 0) return 0;
    return sum / count;
  }

  applyWeather(person, weather, kernel) {
    if (!person) return;
    if (!person.clothing || !person.clothing.layers) return;
    const rain = weather && typeof weather.rain === 'number' ? weather.rain : 0;
    const temp = weather && typeof weather.temperature === 'number' ? weather.temperature : 0.5;
    const dryingRate = Math.max(0, temp - 0.2);
    const wettingRate = Math.max(0, rain);
    const layers = person.clothing.layers;
    for (const slot of SLOTS) {
      const arr = layers[slot];
      if (!arr) continue;
      for (const layer of arr) {
        const mat = MATERIAL_PROPERTIES[layer.material] || MATERIAL_PROPERTIES.linen;
        const resistance = mat.waterResistance;
        const absorb = wettingRate * (1 - resistance);
        layer.wetness = Math.min(1, (layer.wetness || 0) + absorb * 0.4);
        const dry = dryingRate * (1 + 0.5 * (1 - mat.waterResistance));
        layer.wetness = Math.max(0, layer.wetness - dry * 0.05);
        if (wettingRate > 0.5 && kernel && kernel.rng) {
          const r = kernel.rng.next();
          const damageProb = wettingRate * 0.02 * (1 - resistance);
          if (r < damageProb) layer.condition = Math.max(0, layer.condition - 0.01);
        }
      }
    }
  }

  _normalizeLayer(layer) {
    const material = MATERIAL_PROPERTIES[layer.material] ? layer.material : 'linen';
    const thickness = typeof layer.thickness === 'number'
      ? Math.max(0.1, Math.min(1, layer.thickness))
      : 0.7;
    const condition = typeof layer.condition === 'number'
      ? Math.max(0, Math.min(1, layer.condition))
      : 1;
    return {
      type: layer.type,
      material,
      thickness,
      condition,
      wetness: typeof layer.wetness === 'number' ? Math.max(0, Math.min(1, layer.wetness)) : 0,
      ageTurns: 0
    };
  }

  _applyWetnessDecay(layer) {
    if (!layer) return;
    if (typeof layer.condition !== 'number') layer.condition = 1;
    if (typeof layer.wetness !== 'number') layer.wetness = 0;
  }

  _layerEffectiveInsulation(layer) {
    if (!layer) return 0;
    const mat = MATERIAL_PROPERTIES[layer.material] || MATERIAL_PROPERTIES.linen;
    const condition = typeof layer.condition === 'number' ? Math.max(0, layer.condition) : 0;
    const thickness = typeof layer.thickness === 'number' ? Math.max(0, layer.thickness) : 0;
    const wet = typeof layer.wetness === 'number' ? layer.wetness : 0;
    const wetPenalty = 1 - (0.5 * wet);
    return mat.insulation * thickness * condition * wetPenalty;
  }

  _decayLayer(layer, kernel) {
    if (!layer) return;
    const mat = MATERIAL_PROPERTIES[layer.material] || MATERIAL_PROPERTIES.linen;
    let wear = (1 - mat.durability) * 0.0008;
    if (kernel && kernel.rng) {
      wear += kernel.rng.next() * 0.0004;
    }
    if ((layer.wetness || 0) > 0.5) wear *= 2;
    layer.condition = Math.max(0, layer.condition - wear);
    if (layer.ageTurns !== undefined) layer.ageTurns++;
  }

  _dryLayer(layer, kernel) {
    if (!layer) return;
    if (!(layer.wetness > 0)) return;
    const mat = MATERIAL_PROPERTIES[layer.material] || MATERIAL_PROPERTIES.linen;
    let roll = 0.5;
    if (kernel && kernel.rng) roll = kernel.rng.next();
    const dryness = 0.02 + roll * 0.02;
    const resistance = mat.waterResistance;
    const evaporation = dryness * (0.4 + 0.6 * resistance);
    layer.wetness = Math.max(0, layer.wetness - evaporation);
  }

  _allPeople() {
    if (!this.kernel) return [];
    if (this.kernel.alivePeople && this.kernel.alivePeople.size) {
      return Array.from(this.kernel.alivePeople);
    }
    if (this.kernel.entities) {
      const out = [];
      for (const e of this.kernel.entities.values()) {
        if (e && e.isPerson) out.push(e);
      }
      return out;
    }
    return [];
  }
}

export const ClothingInternals = {
  MATERIAL_PROPERTIES,
  LAYER_TYPE_TO_SLOT,
  SLOTS,
  TICK_INTERVAL
};
