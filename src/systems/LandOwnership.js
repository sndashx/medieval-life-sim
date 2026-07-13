/**
 * LandOwnership.js
 * Land parcels, ownership transfer, annexation, claims, taxation
 * Tracks who owns what land and the political claims over disputed territory.
 *
 * Land is identified by tile coordinates (x, y). Each parcel has:
 *   - owner: person id | null (unclaimed) | 'settlement:<id>' | 'faction:<id>'
 *   - claim: weaker prior claim (used for annexation disputes)
 *   - value: estimated wealth (driven by biome/resources/local economy)
 *   - improvements: count of buildings placed (increases value)
 *   - history: ledger of transfers
 *
 * Currency is derived from `areaWealth` — the sum of parcel values in the
 * settlement that owns or claims the land — so prices shift with local
 * economic conditions.
 */

export class LandOwnership {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    /** @type {Map<string, Parcel>} tileKey -> parcel */
    this.parcels = new Map();
    /** claims a person/faction has registered but does not yet own */
    this.claims = new Map();
    this.nextParcelId = 1;
    this.nextClaimId = 1;
    /** currency multipliers keyed by settlement id; recomputed each update */
    this.regionalCurrency = new Map();
  }

  _key(x, y) { return `${x},${y}`; }

  /**
   * Create a parcel at (x,y). Idempotent: returns existing parcel if present.
   */
  createParcel(x, y, opts = {}) {
    const key = this._key(x, y);
    if (this.parcels.has(key)) return this.parcels.get(key);
    const parcel = {
      id: this.nextParcelId++,
      x, y,
      owner: opts.owner ?? null,
      claim: opts.claim ?? null,
      value: opts.value ?? this._estimateValue(x, y),
      improvements: 0,
      claimedAt: opts.claim ? this.kernel?.turn ?? 0 : null,
      ownedAt: opts.owner ? this.kernel?.turn ?? 0 : null,
      history: []
    };
    this.parcels.set(key, parcel);
    return parcel;
  }

  _estimateValue(x, y) {
    if (!this.game?.world) return 10;
    const tile = this.game.world.getTile(x, y);
    if (!tile) return 10;
    let v = 10;
    if (tile.resources && tile.resources.length) v += tile.resources.reduce((s, r) => s + (r.amount || 0), 0) * 0.5;
    if (tile.biome?.type === 'forest') v += 8;
    if (tile.biome?.type === 'grassland' || tile.biome?.type === 'plains') v += 12;
    if (tile.terrain?.elevation > 200) v += 20; // mountains have minerals
    if (tile.climate?.rainfall > 5) v += 5;
    if (tile.settlement) v += 50;
    return Math.max(1, Math.round(v));
  }

  getParcel(x, y) {
    return this.parcels.get(this._key(x, y)) || null;
  }

  /**
   * Register a claim (a formal assertion of ownership without yet having the
   * means to enforce it). Used for political pressure and to slow annexation.
   */
  registerClaim(x, y, claimant, justification = '') {
    const parcel = this.createParcel(x, y);
    const claim = {
      id: this.nextClaimId++,
      parcelId: parcel.id,
      claimant: typeof claimant === 'object' ? claimant.id : claimant,
      justification,
      filed: this.kernel?.turn ?? 0,
      active: true
    };
    if (!parcel.claim) parcel.claim = claim.claimant;
    parcel.claimedAt = this.kernel?.turn ?? 0;
    parcel.history.push({ turn: this.game?.kernel?.turn ?? 0, event: 'claim_filed', by: claim.claimant });
    this.claims.set(claim.id, claim);
    return { success: true, claim, parcel };
  }

  /**
   * Buy land — transfers ownership for a price in copper.
   * price is in `area currency`; here we treat 1 unit = 1 copper.
   */
  buyLand(x, y, buyer, price) {
    const parcel = this.getParcel(x, y);
    if (!parcel) return { success: false, reason: 'No such parcel' };
    if (parcel.owner && typeof parcel.owner === 'number' && parcel.owner === buyer.id) {
      return { success: false, reason: 'You already own this land' };
    }
    const wealth = this._getWealth(buyer);
    if (wealth < price) return { success: false, reason: `Not enough wealth (have ${wealth}, need ${price})` };
    this._charge(buyer, price);
    const previousOwner = parcel.owner;
    parcel.owner = buyer.id;
    parcel.ownedAt = this.kernel?.turn ?? 0;
    parcel.claim = null;
    parcel.history.push({ turn: this.game?.kernel?.turn ?? 0, event: 'sale', from: previousOwner, to: buyer.id, price });
    if (previousOwner && typeof previousOwner === 'number') {
      const prev = this.kernel?.entities?.get?.(previousOwner);
      if (prev) this._pay(prev, Math.floor(price * 0.9)); // 10% land tax
    }
    return { success: true, parcel, price };
  }

  /**
   * Sell land back to the pool (or transfer to another owner for free).
   */
  sellLand(x, y, seller, price = 0) {
    const parcel = this.getParcel(x, y);
    if (!parcel) return { success: false, reason: 'No such parcel' };
    if (parcel.owner !== seller.id) return { success: false, reason: 'You do not own this land' };
    parcel.owner = null;
    parcel.ownedAt = null;
    parcel.history.push({ turn: this.game?.kernel?.turn ?? 0, event: 'sale_to_pool', by: seller.id, price });
    if (price > 0) this._pay(seller, price);
    return { success: true, parcel };
  }

  /**
   * Annex land by force — only succeeds if the annexer controls a faction with
   * enough military power AND the previous owner cannot defend.
   * Returns the battle resolution summary if a contest occurred.
   */
  annexLand(x, y, annexer, militaryPower = 1, justification = '') {
    const parcel = this.getParcel(x, y);
    if (!parcel) return { success: false, reason: 'No such parcel' };
    if (parcel.owner === annexer.id) return { success: false, reason: 'Already yours' };

    let contest = null;
    if (parcel.owner && typeof parcel.owner === 'number') {
      const defender = this.kernel?.entities?.get?.(parcel.owner);
      const defenderPower = defender?.militaryPower ?? defender?.householdSize ?? 1;
      if (defender && militaryPower <= defenderPower) {
        return { success: false, reason: `Annexation failed: defender power ${defenderPower} >= your ${militaryPower}` };
      }
      contest = { defender: parcel.owner, defenderPower, attackerPower: militaryPower };
    }

    const previousOwner = parcel.owner;
    parcel.owner = annexer.id;
    parcel.ownedAt = this.kernel?.turn ?? 0;
    parcel.claim = null;
    parcel.history.push({ turn: this.game?.kernel?.turn ?? 0, event: 'annex', from: previousOwner, to: annexer.id, justification, contest });
    return { success: true, parcel, contest };
  }

  /**
   * Improve a parcel — adds a building, increasing its value.
   */
  improveParcel(x, y, ownerId, improvementValue = 10) {
    const parcel = this.getParcel(x, y);
    if (!parcel) return { success: false, reason: 'No such parcel' };
    if (parcel.owner !== ownerId) return { success: false, reason: 'You do not own this parcel' };
    parcel.improvements += 1;
    parcel.value += improvementValue;
    parcel.history.push({ turn: this.game?.kernel?.turn ?? 0, event: 'improve', value: improvementValue });
    return { success: true, parcel };
  }

  /**
   * Compute area wealth for a settlement by summing the value of every
   * parcel currently owned by that settlement or its citizens.
   */
  computeAreaWealth(settlementId) {
    let total = 0;
    for (const parcel of this.parcels.values()) {
      if (parcel.owner === settlementId || (typeof parcel.owner === 'string' && parcel.owner === `settlement:${settlementId}`)) {
        total += parcel.value;
      } else if (this.kernel?.bySettlement?.get?.(settlementId)?.has?.(this.kernel.entities.get(parcel.owner))) {
        total += parcel.value;
      }
    }
    return total;
  }

  /**
   * Recompute the regional currency multiplier for every known settlement.
   * Wealthier areas have stronger currencies; poor areas have weaker ones.
   * 1.0 = baseline. Range clamped to [0.5, 2.0].
   */
  recomputeRegionalCurrency() {
    const settlements = this.game?.world?.settlements || [];
    if (settlements.length === 0) return;
    const totalWealth = settlements.reduce((s, _st, i) => s + Math.max(1, this.computeAreaWealth(i)), 0);
    const avgWealth = totalWealth / settlements.length;
    for (let i = 0; i < settlements.length; i++) {
      const w = Math.max(1, this.computeAreaWealth(i));
      const multiplier = Math.max(0.5, Math.min(2.0, w / avgWealth));
      this.regionalCurrency.set(i, multiplier);
    }
  }

  /** Price in copper for land in a settlement, adjusted by area currency. */
  getLandPrice(x, y, settlementId) {
    const parcel = this.getParcel(x, y);
    if (!parcel) return null;
    const multiplier = this.regionalCurrency.get(settlementId) ?? 1;
    return Math.round(parcel.value * multiplier);
  }

  _getWealth(person) {
    if (!person) return 0;
    if (typeof person.wealth === 'number') return person.wealth;
    const h = this.kernel?.entities?.get?.(person.household);
    if (h) return h.wealth || 0;
    return 0;
  }
  _charge(person, amount) {
    if (typeof person.wealth === 'number') { person.wealth -= amount; return; }
    const h = this.kernel?.entities?.get?.(person.household);
    if (h) h.wealth = (h.wealth || 0) - amount;
  }
  _pay(person, amount) {
    if (typeof person.wealth === 'number') { person.wealth += amount; return; }
    const h = this.kernel?.entities?.get?.(person.household);
    if (h) h.wealth = (h.wealth || 0) + amount;
  }

  /** Per-tick: refresh currency multipliers; clean up ancient claims. */
  update(turn) {
    this.recomputeRegionalCurrency();
    // Drop claims older than 1 in-game year
    const cutoff = this.kernel?.turn ?? 0 - 365 * 24 * 60 * 60 * 1000;
    for (const [id, claim] of this.claims) {
      if (claim.filed < cutoff && claim.active) {
        const parcel = this.parcels.get(`${claim.x},${claim.y}`) || [...this.parcels.values()].find(p => p.id === claim.parcelId);
        if (!parcel || !parcel.claim) {
          claim.active = false;
          this.claims.delete(id);
        }
      }
    }
  }

  toJSON() {
    return {
      parcels: Array.from(this.parcels.entries()),
      claims: Array.from(this.claims.entries()),
      nextParcelId: this.nextParcelId,
      nextClaimId: this.nextClaimId,
      regionalCurrency: Array.from(this.regionalCurrency.entries())
    };
  }
  fromJSON(data) {
    if (!data) return;
    if (data.parcels) this.parcels = new Map(data.parcels);
    if (data.claims) this.claims = new Map(data.claims);
    if (data.nextParcelId) this.nextParcelId = data.nextParcelId;
    if (data.nextClaimId) this.nextClaimId = data.nextClaimId;
    if (data.regionalCurrency) this.regionalCurrency = new Map(data.regionalCurrency);
  }
}