/**
 * Economy.js
 * Legacy wealth-tracking shim. The market / pricing / per-settlement-shop
 * logic moved to `TradingSystem` (TRACK 2). This class only retains `trades`
 * as a historical ledger and `markets` / `prices` for save-file back-compat.
 * Do NOT add new market wiring here — edit `systems/Trading.js` instead.
 */

export class Economy {
  constructor() {
    this.markets = new Map();
    this.prices = new Map();
    this.trades = [];
  }

  /** @deprecated Use game.trading.initMarket(settlementId, name, settlement). */
  initMarket(settlementId) {
    if (!this.markets.has(settlementId)) {
      this.markets.set(settlementId, { supply: new Map(), demand: new Map(), traders: [] });
    }
  }

  /** @deprecated No-op. Pricing is computed in Trading.calculatePrice. */
  updatePrices(settlementId) {
    /* intentionally empty */
  }

  /** @deprecated Use Trading.calculatePrice / Trading.getBasePrice. */
  getBasePrice(good) {
    const prices = {
      'food': 1,
      'wood': 2,
      'stone': 3,
      'iron': 10,
      'cloth': 5,
      'tool': 15,
      'weapon': 25,
      'armor': 50
    };
    return prices[good] || 1;
  }

  trade(buyerId, sellerId, good, amount, settlementId) {
    const price = this.prices.get(`${settlementId}-${good}`) || this.getBasePrice(good);
    const totalCost = price * amount;

    this.trades.push({
      buyer: buyerId,
      seller: sellerId,
      good: good,
      amount: amount,
      price: price,
      total: totalCost,
      settlement: settlementId,
      turn: this.kernel?.turn ?? 0
    });

    return { success: true, cost: totalCost };
  }
}