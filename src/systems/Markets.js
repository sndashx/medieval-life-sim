/**
 * Markets.js
 * Price discovery, arbitrage, monopolies, inflation
 * Models supply/demand, market power, price dynamics
 */

export class Markets {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.markets = new Map();
    this.goods = new Map();
    this.trades = new Map();
    this.prices = new Map();
    this.nextMarketId = 1;
    this.nextTradeId = 1;
  }

  createMarket(location, name, type) {
    const market = {
      id: this.nextMarketId++,
      location: location,
      name: name,
      type: type, // local, regional, international
      goods: new Map(),
      traders: [],
      volume: 0,
      established: this.kernel?.turn ?? 0,
      regulations: {
        priceControls: false,
        qualityStandards: false,
        monopolyRestrictions: false
      }
    };
    
    this.markets.set(market.id, market);
    return market;
  }

  registerGood(name, category, baseValue) {
    const good = {
      name: name,
      category: category, // food, tools, luxury, raw_material
      baseValue: baseValue,
      perishable: this.isPerishable(category),
      bulky: this.isBulky(category),
      markets: new Map() // marketId -> { price, supply, demand }
    };
    
    this.goods.set(name, good);
    return good;
  }

  isPerishable(category) {
    return ['food', 'flowers'].includes(category);
  }

  isBulky(category) {
    return ['raw_material', 'furniture', 'livestock'].includes(category);
  }

  setPrice(marketId, goodName, price) {
    const market = this.markets.get(marketId);
    const good = this.goods.get(goodName);
    
    if (!market || !good) {
      return { success: false, reason: 'Market or good not found' };
    }
    
    // Initialize market data for good
    if (!good.markets.has(marketId)) {
      good.markets.set(marketId, {
        price: price,
        supply: 0,
        demand: 0,
        history: []
      });
    } else {
      const marketData = good.markets.get(marketId);
      marketData.history.push({
        price: marketData.price,
        timestamp: this.kernel?.turn ?? 0
      });
      marketData.price = price;
    }
    
    return { success: true, price: price };
  }

  calculatePrice(marketId, goodName) {
    const market = this.markets.get(marketId);
    const good = this.goods.get(goodName);
    
    if (!market || !good) return null;
    
    const marketData = good.markets.get(marketId);
    if (!marketData) return good.baseValue;
    
    // Supply and demand pricing
    const supplyDemandRatio = marketData.supply / Math.max(1, marketData.demand);
    
    let price = good.baseValue;
    
    // High demand, low supply = high price
    if (supplyDemandRatio < 0.5) {
      price *= 2;
    } else if (supplyDemandRatio < 1) {
      price *= 1.5;
    } else if (supplyDemandRatio > 2) {
      price *= 0.5;
    } else if (supplyDemandRatio > 1.5) {
      price *= 0.75;
    }
    
    // Perishable goods have price pressure
    if (good.perishable && marketData.supply > marketData.demand) {
      price *= 0.7;
    }
    
    // Market type affects price
    if (market.type === 'international') {
      price *= 1.2; // Higher prices in international markets
    }
    
    return price;
  }

  trade(marketId, seller, buyer, goodName, quantity, agreedPrice) {
    const market = this.markets.get(marketId);
    const good = this.goods.get(goodName);
    
    if (!market || !good) {
      return { success: false, reason: 'Market or good not found' };
    }
    
    // Check seller has goods
    if (!seller.inventory || !seller.inventory[goodName] || seller.inventory[goodName] < quantity) {
      return { success: false, reason: 'Seller has insufficient goods' };
    }
    
    // Check buyer has funds
    const totalCost = agreedPrice * quantity;
    if (buyer.wealth < totalCost) {
      return { success: false, reason: 'Buyer has insufficient funds' };
    }
    
    // Execute trade
    seller.inventory[goodName] -= quantity;
    buyer.inventory = buyer.inventory || {};
    buyer.inventory[goodName] = (buyer.inventory[goodName] || 0) + quantity;
    
    seller.wealth += totalCost;
    buyer.wealth -= totalCost;
    
    // Record trade
    const trade = {
      id: this.nextTradeId++,
      market: marketId,
      seller: seller.id,
      buyer: buyer.id,
      good: goodName,
      quantity: quantity,
      price: agreedPrice,
      totalValue: totalCost,
      timestamp: this.kernel?.turn ?? 0
    };
    
    this.trades.set(trade.id, trade);
    
    // Update market data
    const marketData = good.markets.get(marketId);
    if (marketData) {
      marketData.supply -= quantity;
      marketData.demand -= quantity;
    }
    
    market.volume += totalCost;
    
    // Update price based on trade
    this.setPrice(marketId, goodName, agreedPrice);
    
    return {
      success: true,
      trade: trade
    };
  }

  addSupply(marketId, goodName, quantity) {
    const good = this.goods.get(goodName);
    if (!good) return { success: false, reason: 'Unknown good' };
    
    let marketData = good.markets.get(marketId);
    if (!marketData) {
      marketData = {
        price: good.baseValue,
        supply: 0,
        demand: 0,
        history: []
      };
      good.markets.set(marketId, marketData);
    }
    
    marketData.supply += quantity;
    
    // Recalculate price
    const newPrice = this.calculatePrice(marketId, goodName);
    this.setPrice(marketId, goodName, newPrice);
    
    return {
      success: true,
      supply: marketData.supply,
      price: newPrice
    };
  }

  addDemand(marketId, goodName, quantity) {
    const good = this.goods.get(goodName);
    if (!good) return { success: false, reason: 'Unknown good' };
    
    let marketData = good.markets.get(marketId);
    if (!marketData) {
      marketData = {
        price: good.baseValue,
        supply: 0,
        demand: 0,
        history: []
      };
      good.markets.set(marketId, marketData);
    }
    
    marketData.demand += quantity;
    
    // Recalculate price
    const newPrice = this.calculatePrice(marketId, goodName);
    this.setPrice(marketId, goodName, newPrice);
    
    return {
      success: true,
      demand: marketData.demand,
      price: newPrice
    };
  }

  arbitrage(trader, goodName, fromMarketId, toMarketId, quantity) {
    const fromMarket = this.markets.get(fromMarketId);
    const toMarket = this.markets.get(toMarketId);
    const good = this.goods.get(goodName);
    
    if (!fromMarket || !toMarket || !good) {
      return { success: false, reason: 'Market or good not found' };
    }
    
    // Get prices
    const buyPrice = this.calculatePrice(fromMarketId, goodName);
    const sellPrice = this.calculatePrice(toMarketId, goodName);
    
    // Calculate profit potential
    const profit = (sellPrice - buyPrice) * quantity;
    
    // Calculate transport cost
    const distance = Math.sqrt(
      Math.pow(toMarket.location.x - fromMarket.location.x, 2) +
      Math.pow(toMarket.location.y - fromMarket.location.y, 2)
    );
    
    const transportCost = distance * 0.1 * quantity;
    
    // Account for bulk
    if (good.bulky) {
      transportCost *= 2;
    }
    
    const netProfit = profit - transportCost;
    
    if (netProfit <= 0) {
      return {
        success: false,
        reason: 'No arbitrage opportunity',
        profit: netProfit
      };
    }
    
    // Execute arbitrage
    // Buy in from market
    const buyResult = this.trade(
      fromMarketId,
      { id: 'market', inventory: { [goodName]: quantity }, wealth: Infinity },
      trader,
      goodName,
      quantity,
      buyPrice
    );
    
    if (!buyResult.success) {
      return buyResult;
    }
    
    // Sell in to market
    const sellResult = this.trade(
      toMarketId,
      trader,
      { id: 'market', inventory: {}, wealth: Infinity },
      goodName,
      quantity,
      sellPrice
    );
    
    if (!sellResult.success) {
      return sellResult;
    }
    
    // Deduct transport cost
    trader.wealth -= transportCost;
    
    return {
      success: true,
      profit: netProfit,
      buyPrice: buyPrice,
      sellPrice: sellPrice,
      transportCost: transportCost
    };
  }

  establishMonopoly(trader, marketId, goodName) {
    const market = this.markets.get(marketId);
    const good = this.goods.get(goodName);
    
    if (!market || !good) {
      return { success: false, reason: 'Market or good not found' };
    }
    
    // Check if regulations prevent monopoly
    if (market.regulations.monopolyRestrictions) {
      return { success: false, reason: 'Monopolies restricted in this market' };
    }
    
    // Check if trader controls enough supply
    const marketData = good.markets.get(marketId);
    if (!marketData) {
      return { success: false, reason: 'Good not traded in this market' };
    }
    
    const traderSupply = trader.inventory?.[goodName] || 0;
    const marketShare = traderSupply / (marketData.supply + traderSupply);
    
    if (marketShare < 0.7) {
      return {
        success: false,
        reason: 'Insufficient market share',
        currentShare: marketShare
      };
    }
    
    // Establish monopoly
    const monopoly = {
      trader: trader.id,
      market: marketId,
      good: goodName,
      established: this.kernel?.turn ?? 0,
      marketShare: marketShare,
      priceControl: true
    };
    
    // Monopolist can set higher prices
    const currentPrice = marketData.price;
    const monopolyPrice = currentPrice * 1.5;
    this.setPrice(marketId, goodName, monopolyPrice);
    
    return {
      success: true,
      monopoly: monopoly,
      priceIncrease: monopolyPrice - currentPrice
    };
  }

  calculateInflation(marketId, timeWindow) {
    const market = this.markets.get(marketId);
    if (!market) return 0;
    
    let totalPriceChange = 0;
    let goodCount = 0;
    
    for (const good of this.goods.values()) {
      const marketData = good.markets.get(marketId);
      if (!marketData || marketData.history.length === 0) continue;
      
      // Get price from timeWindow ago
      const oldPrice = marketData.history.find(h => 
        this.kernel?.turn ?? 0 - h.timestamp >= timeWindow
      );
      
      if (oldPrice) {
        const priceChange = (marketData.price - oldPrice.price) / oldPrice.price;
        totalPriceChange += priceChange;
        goodCount++;
      }
    }
    
    return goodCount > 0 ? totalPriceChange / goodCount : 0;
  }

  imposePriceControl(marketId, goodName, maxPrice) {
    const market = this.markets.get(marketId);
    const good = this.goods.get(goodName);
    
    if (!market || !good) {
      return { success: false, reason: 'Market or good not found' };
    }
    
    market.regulations.priceControls = true;
    
    const marketData = good.markets.get(marketId);
    if (marketData && marketData.price > maxPrice) {
      this.setPrice(marketId, goodName, maxPrice);
      
      // Price controls can create shortages
      const shortage = marketData.demand - marketData.supply;
      
      return {
        success: true,
        priceReduced: true,
        shortage: shortage > 0 ? shortage : 0
      };
    }
    
    return {
      success: true,
      priceReduced: false
    };
  }

  simulateMarket(marketId, timeStep) {
    const market = this.markets.get(marketId);
    if (!market) return;
    
    // Natural supply/demand fluctuations
    for (const good of this.goods.values()) {
      const marketData = good.markets.get(marketId);
      if (!marketData) continue;
      
      // Demand fluctuates
      const demandChange = (this.kernel.random() - 0.5) * 0.1 * marketData.demand;
      marketData.demand = Math.max(0, marketData.demand + demandChange);
      
      // Supply adjusts to demand (slowly)
      const supplyAdjustment = (marketData.demand - marketData.supply) * 0.05;
      marketData.supply = Math.max(0, marketData.supply + supplyAdjustment);
      
      // Perishable goods decay
      if (good.perishable) {
        marketData.supply *= 0.95;
      }
      
      // Recalculate price
      const newPrice = this.calculatePrice(marketId, good.name);
      this.setPrice(marketId, good.name, newPrice);
    }
  }

  getMarket(id) {
    return this.markets.get(id);
  }

  getGood(name) {
    return this.goods.get(name);
  }

  getTrade(id) {
    return this.trades.get(id);
  }

  getPrice(marketId, goodName) {
    const good = this.goods.get(goodName);
    if (!good) return null;
    
    const marketData = good.markets.get(marketId);
    return marketData ? marketData.price : good.baseValue;
  }

  getTradesByMarket(marketId) {
    return Array.from(this.trades.values())
      .filter(t => t.market === marketId);
  }

  getTradesByTrader(traderId) {
    return Array.from(this.trades.values())
      .filter(t => t.seller === traderId || t.buyer === traderId);
  }

  getPriceHistory(marketId, goodName) {
    const good = this.goods.get(goodName);
    if (!good) return [];
    
    const marketData = good.markets.get(marketId);
    return marketData ? marketData.history : [];
  }

  getArbitrageOpportunities(goodName) {
    const good = this.goods.get(goodName);
    if (!good) return [];
    
    const opportunities = [];
    const markets = Array.from(good.markets.entries());
    
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const [market1Id, data1] = markets[i];
        const [market2Id, data2] = markets[j];
        
        const priceDiff = Math.abs(data1.price - data2.price);
        
        if (priceDiff > good.baseValue * 0.2) {
          opportunities.push({
            good: goodName,
            fromMarket: data1.price < data2.price ? market1Id : market2Id,
            toMarket: data1.price < data2.price ? market2Id : market1Id,
            priceDifference: priceDiff,
            profitPotential: priceDiff * 0.7 // Rough estimate after costs
          });
        }
      }
    }
    
    return opportunities;
  }
}
