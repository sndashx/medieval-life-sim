/**
 * Sanitation.js
 * Medieval sanitation infrastructure: latrines, cesspits, garderobes, privies.
 * Models sanitation coverage per settlement, waste accumulation, water
 * contamination, and disease-vector event emission for the Pathogens system.
 *
 * Per-turn adapter is throttled to once per game-day (1440 turns) — the same
 * cadence used by Communication and other turn-based systems.
 */

const TURNS_PER_DAY = 1440;

const LATRINE_TYPES = {
  pit:      { coverage: 0.05, capacity: 50,   cost: 5,   maintainCost: 0.1 },
  cesspit:  { coverage: 0.12, capacity: 200,  cost: 25,  maintainCost: 0.4 },
  garderobe:{ coverage: 0.20, capacity: 500,  cost: 80,  maintainCost: 0.8 }
};

export class Sanitation {
  constructor(kernel, game) {
    this.kernel = kernel;
    this.game = game;
    this.settlements = new Map();
    this._lastUpdateTurn = -Infinity;
    this._rng = null;
    this._nextLatrineId = 1;
  }

  /**
   * Per-tick adapter. Throttles to once per game-day so waste/water math
   * doesn't run on every single minute. Called via safeUpdate from Game.
   */
  update(kernel) {
    if (!kernel) return;
    this._rng = kernel.rng;
    const turn = kernel.turn || 0;
    if (turn - this._lastUpdateTurn < TURNS_PER_DAY) return;
    this._lastUpdateTurn = turn;

    for (const [settlementId, state] of this.settlements) {
      this._accumulateWaste(settlementId, state, turn);
      this._checkWaterContamination(settlementId, this._rng);
    }
  }

  /**
   * Initialize per-settlement sanitation state. Idempotent: calling twice
   * does not clobber existing latrine inventory.
   */
  initialize(settlements) {
    if (!settlements) return;
    const list = Array.isArray(settlements) ? settlements : Array.from(settlements.values?.() || []);
    for (const settlement of list) {
      if (!settlement || settlement.id === undefined) continue;
      if (this.settlements.has(settlement.id)) continue;
      const population = Math.max(0, settlement.population || 0);
      this.settlements.set(settlement.id, {
        settlementId: settlement.id,
        name: settlement.name || null,
        population,
        latrines: [],
        coverage: 0,
        wasteAccumulated: 0,
        wasteCapacity: 0,
        waterQuality: settlement.waterQuality ?? 1.0,
        lastUpdateTurn: 0
      });
    }
  }

  /**
   * Returns sanitation score in [0,1]. Coverage is the primary signal; full
   * capacity (no overflow) gives a small bonus; never exceeds 1.
   */
  getSanitationScore(settlementId) {
    const state = this.settlements.get(settlementId);
    if (!state) return 0;
    const coverage = Math.min(1, state.coverage);
    const overflow = state.wasteCapacity > 0
      ? Math.min(1, state.wasteAccumulated / state.wasteCapacity)
      : (state.wasteAccumulated > 0 ? 1 : 0);
    const overflowPenalty = overflow * 0.2;
    const score = coverage - overflowPenalty;
    if (score < 0) return 0;
    if (score > 1) return 1;
    return score;
  }

  /**
   * Probability of emitting a `water_contaminated` event this tick. Higher
   * for low-coverage / high-overflow settlements. Uses the supplied rng
   * (kernel's SeededRNG) so the result is deterministic.
   */
  _checkWaterContamination(settlementId, rng) {
    if (!rng) return false;
    const state = this.settlements.get(settlementId);
    if (!state) return false;

    const score = this.getSanitationScore(settlementId);
    const baseProbability = Math.max(0, 0.25 * (1 - score));
    const overflow = state.wasteCapacity > 0
      ? Math.max(0, (state.wasteAccumulated - state.wasteCapacity) / state.wasteCapacity)
      : 0;
    const probability = Math.min(0.95, baseProbability + overflow * 0.3);
    if (probability <= 0) return false;

    const roll = rng.next();
    if (roll >= probability) return false;

    if (this.kernel && typeof this.kernel.scheduleEvent === 'function') {
      this.kernel.scheduleEvent({
        type: 'water_contaminated',
        settlementId,
        severity: 1 - score,
        source: 'sanitation',
        turn: this.kernel.turn || 0
      });
    }
    if (state.waterQuality > 0) {
      state.waterQuality = Math.max(0, state.waterQuality - (0.1 * (1 - score)));
    }
    return true;
  }

  /**
   * Add a latrine to a settlement. `type` must be one of LATRINE_TYPES.
   * Returns { success, latrineId, coverage } or { success:false, reason }.
   */
  buildLatrine(settlementId, type) {
    const spec = LATRINE_TYPES[type];
    if (!spec) {
      return { success: false, reason: `unknown latrine type: ${type}` };
    }
    const state = this.settlements.get(settlementId);
    if (!state) {
      return { success: false, reason: `unknown settlement: ${settlementId}` };
    }
    const latrine = {
      id: this._nextLatrineId++,
      type,
      coverage: spec.coverage,
      capacity: spec.capacity,
      maintainCost: spec.maintainCost,
      waste: 0,
      builtAt: this.kernel ? (this.kernel.turn || 0) : 0
    };
    state.latrines.push(latrine);
    state.wasteCapacity += spec.capacity;
    state.coverage = Math.min(1, state.coverage + spec.coverage);
    return { success: true, latrineId: latrine.id, coverage: state.coverage };
  }

  getLatrines(settlementId) {
    const state = this.settlements.get(settlementId);
    if (!state) return [];
    return state.latrines.slice();
  }

  /**
   * Per-person hygiene. Called once per game-day from Game (orchestrator
   * decides wiring). Hygiene decays; worse sanitation → faster decay and
   * a higher disease exposure chance. Does not touch nutrition fields.
   */
  updatePersonHygiene(person, kernel) {
    if (!person) return;
    if (!person.hygiene || typeof person.hygiene !== 'object') {
      person.hygiene = { cleanliness: 1.0, diseaseExposure: 0 };
    }
    const h = person.hygiene;
    if (typeof h.cleanliness !== 'number') h.cleanliness = 1.0;
    if (typeof h.diseaseExposure !== 'number') h.diseaseExposure = 0;

    let settlementScore = 0.5;
    const settlementId = person.position && person.position.settlementId;
    if (settlementId !== undefined && this.settlements.has(settlementId)) {
      settlementScore = this.getSanitationScore(settlementId);
    }

    const decay = 0.08 + 0.12 * (1 - settlementScore);
    h.cleanliness = Math.max(0, h.cleanliness - decay);
    if (h.cleanliness < 0.3) {
      h.diseaseExposure = Math.min(1, h.diseaseExposure + 0.05);
    }
    if (h.diseaseExposure > 1) h.diseaseExposure = 1;
  }

  _accumulateWaste(settlementId, state, turn) {
    if (!state || state.population <= 0) {
      state.lastUpdateTurn = turn;
      return;
    }
    const dailyWastePerPerson = 0.05;
    const produced = state.population * dailyWastePerPerson;
    const absorbed = Math.min(produced, Math.max(0, state.wasteCapacity - state.wasteAccumulated));
    const overflow = produced - absorbed;
    state.wasteAccumulated += absorbed;
    state.wasteAccumulated += overflow * 0.4;
    if (state.wasteAccumulated > state.wasteCapacity * 2) {
      state.wasteAccumulated = state.wasteCapacity * 2;
    }
    state.lastUpdateTurn = turn;
  }
}
