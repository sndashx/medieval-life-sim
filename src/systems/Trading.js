/**
 * Trading and Economy System
 * Handles shops, merchants, buying/selling, pricing, and economic simulation
 */

import { Household } from './Social.js';

export class TradingSystem {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    this.shops = new Map(); // shopId -> Shop
    this.merchants = new Map(); // merchantId -> Merchant
    this.markets = new Map(); // settlementId -> Market
    this.tradeRoutes = new Map(); // routeId -> TradeRoute
    this.priceHistory = new Map(); // itemType -> [prices]
  }

  /**
   * Initialize a market in a settlement
   */
  initMarket(settlementId, settlementName, settlement = null) {
    // TRACK 2: lastUpdate is now a game-minute count (kernel.worldTime.totalMinutes)
    // so restock cadence lines up with the simulation clock instead of wall time.
    const lastUpdateMin = this.kernel?.worldTime?.totalMinutes ?? 0;
    const market = {
      id: settlementId,
      name: settlementName,
      shops: [],
      priceIndex: new Map(),
      supplyDemand: new Map(),
      wealth: 1000,
      lastUpdate: lastUpdateMin,
      location: settlement ? { x: settlement.x, y: settlement.y } : null,
      localResources: settlement ? this.analyzeLocalResources(settlement) : [],
      tradeConnections: []
    };

    this.markets.set(settlementId, market);
    
    // Create shops based on settlement characteristics
    this.createShop(settlementId, 'general', 'General Store', market);
    
    // Only create specialized shops if settlement is large enough
    const population = settlement?.population || 100;
    if (population > 30) {
      this.createShop(settlementId, 'blacksmith', 'Blacksmith', market);
    }
    if (population > 50) {
      this.createShop(settlementId, 'apothecary', 'Apothecary', market);
    }
    if (population > 20) {
      this.createShop(settlementId, 'tavern', 'The Tavern', market);
    }

    return market;
  }

  /**
   * Analyze local resources near a settlement
   */
  analyzeLocalResources(settlement) {
    const resources = [];
    
    // Check terrain and biome for available resources
    if (this.game && this.game.world) {
      const tile = this.game.world.getTile(settlement.x, settlement.y);
      
      if (tile) {
        // Forest areas have wood and herbs
        if (tile.biome.type === 'forest') {
          resources.push('wood', 'herbs', 'game');
        }
        
        // Plains have agriculture
        if (tile.biome.type === 'plains' || tile.biome.type === 'grassland') {
          resources.push('grain', 'livestock', 'vegetables');
        }
        
        // Mountains have minerals
        if (tile.terrain.elevation > 200) {
          resources.push('iron', 'stone', 'minerals');
        }
        
        // Near water has fish
        if (tile.climate.rainfall > 5) {
          resources.push('fish', 'water');
        }
      }
    }
    
    return resources;
  }

  /**
   * Create a shop in a settlement
   */
  createShop(settlementId, type, name, market = null) {
    const shopId = `shop_${settlementId}_${type}_${this.kernel?.turn ?? 0}`;
    
    const shop = {
      id: shopId,
      name: name,
      type: type,
      settlementId: settlementId,
      owner: null,
      inventory: new Map(),
      wealth: 500,
      reputation: 0.5,
      priceModifier: 1.0,
      location: market?.location || null,
      supplyChains: [], // Where shop gets goods from
      productionCapacity: this.calculateProductionCapacity(type, market)
    };

    // Stock initial inventory based on shop type AND local resources
    this.stockShop(shop, market);

    this.shops.set(shopId, shop);
    
    if (!market) {
      market = this.markets.get(settlementId);
    }
    
    if (market) {
      market.shops.push(shopId);
    }

    return shop;
  }

  /**
   * Calculate production capacity based on shop type and location
   */
  calculateProductionCapacity(type, market) {
    const baseCapacity = {
      'general': 1.0,
      'blacksmith': 0.5,
      'apothecary': 0.3,
      'tavern': 0.8
    };

    let capacity = baseCapacity[type] || 1.0;

    // Modify based on local resources
    if (market && market.localResources) {
      if (type === 'blacksmith' && market.localResources.includes('iron')) {
        capacity *= 1.5;
      }
      if (type === 'apothecary' && market.localResources.includes('herbs')) {
        capacity *= 1.5;
      }
      if (type === 'general' && market.localResources.includes('grain')) {
        capacity *= 1.3;
      }
      if (type === 'tavern' && market.localResources.includes('grain')) {
        capacity *= 1.2;
      }
    }

    return capacity;
  }

  /**
   * Stock a shop with initial inventory based on location and resources
   */
  stockShop(shop, market = null) {
    if (!market) {
      market = this.markets.get(shop.settlementId);
    }

    const localResources = market?.localResources || [];
    
    // Base inventory templates
    const inventoryByType = {
      'general': [
        { type: 'food', subtype: 'bread', quantity: 50, basePrice: 2, requires: ['grain'] },
        { type: 'food', subtype: 'cheese', quantity: 30, basePrice: 3, requires: ['livestock'] },
        { type: 'food', subtype: 'meat', quantity: 20, basePrice: 5, requires: ['livestock', 'game'] },
        { type: 'food', subtype: 'vegetables', quantity: 40, basePrice: 2, requires: ['vegetables'] },
        { type: 'food', subtype: 'fish', quantity: 25, basePrice: 4, requires: ['fish'] },
        { type: 'clothing', subtype: 'tunic', quantity: 10, basePrice: 15, requires: [] },
        { type: 'tool', subtype: 'knife', quantity: 15, basePrice: 8, requires: ['iron'] }
      ],
      'blacksmith': [
        { type: 'weapon', subtype: 'sword', quantity: 5, basePrice: 50, requires: ['iron'] },
        { type: 'weapon', subtype: 'axe', quantity: 8, basePrice: 30, requires: ['iron', 'wood'] },
        { type: 'weapon', subtype: 'spear', quantity: 10, basePrice: 20, requires: ['iron', 'wood'] },
        { type: 'armor', subtype: 'leather', quantity: 10, basePrice: 40, requires: ['livestock'] },
        { type: 'armor', subtype: 'chainmail', quantity: 3, basePrice: 100, requires: ['iron'] },
        { type: 'tool', subtype: 'hammer', quantity: 12, basePrice: 10, requires: ['iron', 'wood'] },
        { type: 'tool', subtype: 'nails', quantity: 100, basePrice: 1, requires: ['iron'] },
        { type: 'tool', subtype: 'horseshoe', quantity: 20, basePrice: 5, requires: ['iron'] }
      ],
      'apothecary': [
        { type: 'medicine', subtype: 'bandage', quantity: 30, basePrice: 5, requires: [] },
        { type: 'medicine', subtype: 'potion', quantity: 15, basePrice: 20, requires: ['herbs'] },
        { type: 'medicine', subtype: 'salve', quantity: 20, basePrice: 8, requires: ['herbs'] },
        { type: 'herb', subtype: 'healing', quantity: 25, basePrice: 3, requires: ['herbs'] },
        { type: 'herb', subtype: 'cooking', quantity: 40, basePrice: 2, requires: ['herbs'] },
        { type: 'herb', subtype: 'poison', quantity: 5, basePrice: 15, requires: ['herbs'] }
      ],
      'tavern': [
        { type: 'food', subtype: 'stew', quantity: 40, basePrice: 4, requires: ['vegetables', 'meat'] },
        { type: 'food', subtype: 'bread', quantity: 50, basePrice: 2, requires: ['grain'] },
        { type: 'drink', subtype: 'ale', quantity: 60, basePrice: 2, requires: ['grain'] },
        { type: 'drink', subtype: 'wine', quantity: 20, basePrice: 8, requires: ['grain'] },
        { type: 'drink', subtype: 'water', quantity: 100, basePrice: 1, requires: ['water'] },
        { type: 'lodging', subtype: 'room', quantity: 5, basePrice: 10, requires: [] }
      ]
    };

    const items = inventoryByType[shop.type] || [];
    
    for (const item of items) {
      const itemKey = `${item.type}_${item.subtype}`;
      
      // Check if local resources support this item
      const hasResources = item.requires.length === 0 || 
                          item.requires.some(req => localResources.includes(req));
      
      let quantity = item.quantity;
      let price = item.basePrice;
      
      if (hasResources) {
        // Local production: more stock, lower price
        quantity = Math.floor(quantity * shop.productionCapacity);
        price = Math.floor(price * 0.8);
      } else {
        // Must import: less stock, higher price
        quantity = Math.floor(quantity * 0.3);
        price = Math.floor(price * 1.5);
        
        // Some items may not be available at all if too far from source
        if (item.requires.length > 0 && this.kernel.rng.next() < 0.3) {
          quantity = 0;
        }
      }
      
      if (quantity > 0) {
        shop.inventory.set(itemKey, {
          type: item.type,
          subtype: item.subtype,
          quantity: quantity,
          basePrice: price,
          currentPrice: price,
          locallyProduced: hasResources,
          requires: item.requires
        });
      }
    }
  }

  /**
   * Get shops in a settlement
   */
  getShopsInSettlement(settlementId) {
    const market = this.markets.get(settlementId);
    if (!market) return [];

    return market.shops.map(shopId => this.shops.get(shopId)).filter(s => s);
  }

  /**
   * Get shops near a position
   */
  getShopsNear(x, y, radius = 20) {
    const nearbyShops = [];
    
    for (const [id, shop] of this.shops) {
      // Find shop location from settlement
      const market = this.markets.get(shop.settlementId);
      if (market) {
        // Approximate: shops are at settlement location
        // In full implementation, shops would have specific coordinates
        nearbyShops.push(shop);
      }
    }

    return nearbyShops;
  }

  /**
   * Browse shop inventory
   */
  browseShop(shopId) {
    const shop = this.shops.get(shopId);
    if (!shop) {
      return { success: false, reason: 'Shop not found' };
    }

    const items = [];
    for (const [key, item] of shop.inventory) {
      if (item.quantity > 0) {
        items.push({
          type: item.type,
          subtype: item.subtype,
          quantity: item.quantity,
          price: this.calculatePrice(shop, item)
        });
      }
    }

    return {
      success: true,
      shop: shop,
      items: items
    };
  }

  /**
   * Calculate current price for an item.
   *
   * TRACK 2: `price = basePrice * regionalCurrency[settlementId] * shop.priceModifier`,
   * then layered with supply/demand and scarcity modifiers. Currency comes
   * from game.landOwnership.regionalCurrency and is recomputed every turn.
   */
  calculatePrice(shop, item) {
    let price = item.basePrice;

    // TRACK 2 T2-4: regional currency multiplier (LandOwnership).
    const land = this.game?.landOwnership;
    if (land && land.regionalCurrency && shop.settlementId !== undefined) {
      const currencyMult = land.regionalCurrency.get(shop.settlementId);
      if (typeof currencyMult === 'number') price *= currencyMult;
    }

    // Shop price modifier (reputation, location)
    price *= shop.priceModifier;

    // Supply/demand modifier
    const market = this.markets.get(shop.settlementId);
    if (market) {
      const itemKey = `${item.type}_${item.subtype}`;
      const supplyDemand = market.supplyDemand.get(itemKey);

      if (supplyDemand) {
        // Low supply = higher price
        if (supplyDemand.supply < supplyDemand.demand) {
          price *= 1.5;
        }
        // High supply = lower price
        else if (supplyDemand.supply > supplyDemand.demand * 2) {
          price *= 0.7;
        }
      }
    }

    // Scarcity modifier (low stock)
    if (item.quantity < 5) {
      price *= 1.3;
    }

    return Math.max(1, Math.round(price));
  }

  /**
   * Buy item from shop
   */
  buyItem(person, shopId, itemType, itemSubtype, quantity = 1) {
    const shop = this.shops.get(shopId);
    if (!shop) {
      return { success: false, reason: 'Shop not found' };
    }

    const itemKey = `${itemType}_${itemSubtype}`;
    const item = shop.inventory.get(itemKey);
    
    if (!item) {
      return { success: false, reason: 'Item not available' };
    }

    if (item.quantity < quantity) {
      return { success: false, reason: `Only ${item.quantity} available` };
    }

    const price = this.calculatePrice(shop, item) * quantity;
    
    // Check if person can afford
    const personWealth = this.getPersonWealth(person);
    if (personWealth < price) {
      return { success: false, reason: `Not enough money (need ${price} copper)` };
    }

    // Process transaction
    this.deductWealth(person, price);
    shop.wealth += price;
    
    item.quantity -= quantity;
    
    // Add to person's inventory
    if (person.inventory) {
      for (let i = 0; i < quantity; i++) {
        person.inventory.add({
          type: itemType,
          subtype: itemSubtype,
          basePrice: item.basePrice
        });
      }
    }

    // Update supply/demand
    this.updateSupplyDemand(shop.settlementId, itemKey, -quantity, 0);

    return {
      success: true,
      item: { type: itemType, subtype: itemSubtype },
      quantity: quantity,
      price: price,
      message: `Bought ${quantity}x ${itemSubtype} for ${price} copper`
    };
  }

  /**
   * Sell item to shop
   */
  sellItem(person, shopId, itemType, itemSubtype, quantity = 1) {
    const shop = this.shops.get(shopId);
    if (!shop) {
      return { success: false, reason: 'Shop not found' };
    }

    // Check if person has the item
    if (!person.inventory) {
      return { success: false, reason: 'No inventory' };
    }

    const hasItem = person.inventory.items.filter(
      i => i.type === itemType && i.subtype === itemSubtype
    ).length >= quantity;

    if (!hasItem) {
      return { success: false, reason: 'You don\'t have that item' };
    }

    const itemKey = `${itemType}_${itemSubtype}`;
    let item = shop.inventory.get(itemKey);
    
    // If shop doesn't stock this item, create entry
    if (!item) {
      item = {
        type: itemType,
        subtype: itemSubtype,
        quantity: 0,
        basePrice: 10, // Default price
        currentPrice: 10
      };
      shop.inventory.set(itemKey, item);
    }

    // Shops buy at 60% of sell price
    const sellPrice = Math.floor(this.calculatePrice(shop, item) * 0.6) * quantity;

    if (shop.wealth < sellPrice) {
      return { success: false, reason: 'Shop cannot afford to buy' };
    }

    // Process transaction
    this.addWealth(person, sellPrice);
    shop.wealth -= sellPrice;
    
    item.quantity += quantity;
    
    // Remove from person's inventory
    for (let i = 0; i < quantity; i++) {
      const itemToRemove = person.inventory.items.find(
        it => it.type === itemType && it.subtype === itemSubtype
      );
      if (itemToRemove) {
        person.inventory.remove(itemType, 1);
      }
    }

    // Update supply/demand
    this.updateSupplyDemand(shop.settlementId, itemKey, quantity, 0);

    return {
      success: true,
      item: { type: itemType, subtype: itemSubtype },
      quantity: quantity,
      price: sellPrice,
      message: `Sold ${quantity}x ${itemSubtype} for ${sellPrice} copper`
    };
  }

  /**
   * Attempt to haggle for better price
   */
  haggle(person, shopId, itemType, itemSubtype, targetPrice) {
    const shop = this.shops.get(shopId);
    if (!shop) {
      return { success: false, reason: 'Shop not found' };
    }

    const itemKey = `${itemType}_${itemSubtype}`;
    const item = shop.inventory.get(itemKey);
    
    if (!item) {
      return { success: false, reason: 'Item not available' };
    }

    const currentPrice = this.calculatePrice(shop, item);
    const discount = (currentPrice - targetPrice) / currentPrice;

    // Haggling success based on person's social skills and shop reputation
    const socialSkill = person.skills?.mental?.social?.level || 0;
    const baseChance = 0.3 + (socialSkill / 100) * 0.4;
    
    // Harder to haggle for bigger discounts
    const difficultyModifier = Math.max(0, 1 - discount * 2);
    const successChance = baseChance * difficultyModifier;

    const success = this.kernel.rng.next() < successChance;

    if (success) {
      // Apply temporary discount
      const discountAmount = Math.floor(currentPrice * discount * 0.5); // Get half the requested discount
      const newPrice = currentPrice - discountAmount;
      
      return {
        success: true,
        originalPrice: currentPrice,
        newPrice: newPrice,
        discount: discountAmount,
        message: `Haggled price down to ${newPrice} copper!`
      };
    } else {
      // Small reputation penalty for failed haggling
      shop.reputation = Math.max(0, shop.reputation - 0.01);

      return {
        success: false,
        reason: 'The merchant refuses to lower the price',
        currentPrice: currentPrice
      };
    }
  }

  /**
   * Direct barter between two people — no money changes hands, just goods.
   * Each side offers an item; fairness is the difference in base price.
   *
   * TRACK 2 T2-5: relationship lookup prefers `person.relationships` (the
   * per-person memory map set up by Person.js after T1 lands) and falls back
   * to `game.relationships.getRelationship` (the canonical Relationships
   * registry). Either way, a successful trade *actually* transfers items
   * between both inventories and bumps the bond for both sides.
   */
  barter(initiator, target, initiatorItem, targetItem) {
    if (!initiator || !target) return { success: false, reason: 'Missing party' };
    const basePrices = { food: 1, wood: 2, stone: 3, iron: 10, cloth: 5, tool: 15, weapon: 25, armor: 50 };
    const ip = basePrices[initiatorItem] || 5;
    const tp = basePrices[targetItem] || 5;
    const ratio = Math.min(ip, tp) / Math.max(ip, tp);

    // T2-5: read relationship from person OR game (both supported).
    let rel = null;
    if (initiator.relationships && typeof initiator.relationships.get === 'function') {
      rel = initiator.relationships.get(target.id);
    }
    if (!rel && this.game?.relationships && typeof this.game.relationships.getRelationship === 'function') {
      const bond = this.game.relationships.getRelationship(initiator.id, target.id);
      if (bond) rel = bond;
    }
    const affinity = rel?.affinity ?? 0.5;
    const skill = initiator.skills?.mental?.social?.level || 0;
    const chance = affinity * 0.5 + (skill / 100) * 0.3 + ratio * 0.2;
    const roll = this.kernel.rng.next();

    if (roll < chance) {
      const initItems = initiator.inventory?.items || [];
      const tgtItems = target.inventory?.items || [];
      const a = initItems.find(i => i.type === initiatorItem);
      const b = tgtItems.find(i => i.type === targetItem);
      if (!a || !b) return { success: false, reason: 'Item not in inventory' };

      // Defensive inventory helpers — Person.inventory may expose either
      // .add/.remove (Map) or bare .items (used by RoguelikeUI fallback).
      const removeOne = (person, item) => {
        if (typeof person.inventory?.removeItem === 'function') return person.inventory.removeItem(item);
        if (typeof person.inventory?.remove === 'function') return person.inventory.remove(item.type, 1);
        const idx = person.inventory?.items?.indexOf?.(item);
        if (idx !== undefined && idx >= 0) person.inventory.items.splice(idx, 1);
      };
      const addOne = (person, itemData) => {
        if (typeof person.inventory?.addItem === 'function') return person.inventory.addItem(itemData);
        if (typeof person.inventory?.add === 'function') return person.inventory.add(itemData);
        if (person.inventory?.items?.push) person.inventory.items.push(itemData);
      };

      removeOne(initiator, a);
      removeOne(target, b);
      addOne(initiator, { type: b.type, subtype: b.subtype, mass: b.mass });
      addOne(target, { type: a.type, subtype: a.subtype, mass: a.mass });

      if (rel) {
        rel.affinity = Math.min(1, (rel.affinity || 0) + 0.05);
        rel.trust = Math.min(1, (rel.trust || 0) + 0.03);
      }
      return { success: true, message: `Bartered ${initiatorItem} for ${targetItem}.` };
    }
    if (rel) {
      rel.affinity = Math.max(0, (rel.affinity || 0) - 0.05);
      rel.trust = Math.max(0, (rel.trust || 0) - 0.03);
    }
    return { success: false, reason: `${target.name || 'They'} refuse the unfair trade.` };
  }

  /**
   * Apply a regional currency multiplier to a base price.
   * Wealthier areas have stronger purchasing power; poorer areas are cheaper.
   */
  priceWithCurrency(basePrice, settlementId, game) {
    const land = game?.landOwnership;
    if (!land) return basePrice;
    const mult = land.regionalCurrency.get(settlementId) ?? 1;
    return Math.max(1, Math.round(basePrice * mult));
  }

  /**
   * Get person's total wealth (purse + household)
   */
  getPersonWealth(person) {
    let wealth = 0;
    
    // Personal purse
    if (person.purse) {
      wealth += person.purse.copper || 0;
      wealth += (person.purse.silver || 0) * 10;
      wealth += (person.purse.gold || 0) * 100;
    }
    
    // Household wealth (if head of household)
    if (person.household) {
      const household = this.kernel.entities.get(person.household);
      if (household && household.head === person.id) {
        wealth += household.wealth || 0;
      }
    }
    
    return wealth;
  }

  /**
   * Deduct wealth from person
   */
  deductWealth(person, amount) {
    if (!person.purse) {
      person.purse = { copper: 0, silver: 0, gold: 0 };
    }

    let remaining = amount;
    
    // Try personal purse first
    const personalWealth = (person.purse.copper || 0) + 
                          (person.purse.silver || 0) * 10 + 
                          (person.purse.gold || 0) * 100;
    
    if (personalWealth >= remaining) {
      // Deduct from purse
      this.deductFromPurse(person.purse, remaining);
      return true;
    }
    
    // Use household wealth
    remaining -= personalWealth;
    this.deductFromPurse(person.purse, personalWealth);
    
    if (person.household) {
      const household = this.kernel.entities.get(person.household);
      if (household) {
        household.wealth = Math.max(0, household.wealth - remaining);
      }
    }
    
    return true;
  }

  /**
   * Add wealth to person
   */
  addWealth(person, amount) {
    if (!person.purse) {
      person.purse = { copper: 0, silver: 0, gold: 0 };
    }

    this.addToPurse(person.purse, amount);
  }

  /**
   * Deduct from purse with coin conversion
   */
  deductFromPurse(purse, amount) {
    let remaining = amount;
    
    // Deduct copper
    const copperToTake = Math.min(purse.copper, remaining);
    purse.copper -= copperToTake;
    remaining -= copperToTake;
    
    if (remaining > 0) {
      // Convert silver to copper
      const silverNeeded = Math.ceil(remaining / 10);
      const silverToTake = Math.min(purse.silver, silverNeeded);
      purse.silver -= silverToTake;
      purse.copper += silverToTake * 10 - remaining;
      remaining -= silverToTake * 10;
    }
    
    if (remaining > 0) {
      // Convert gold to copper
      const goldNeeded = Math.ceil(remaining / 100);
      const goldToTake = Math.min(purse.gold, goldNeeded);
      purse.gold -= goldToTake;
      purse.copper += goldToTake * 100 - remaining;
    }
  }

  /**
   * Add to purse with coin conversion
   */
  addToPurse(purse, amount) {
    purse.copper += amount;
    
    // Convert to higher denominations
    if (purse.copper >= 10) {
      const silver = Math.floor(purse.copper / 10);
      purse.silver += silver;
      purse.copper -= silver * 10;
    }
    
    if (purse.silver >= 10) {
      const gold = Math.floor(purse.silver / 10);
      purse.gold += gold;
      purse.silver -= gold * 10;
    }
  }

  /**
   * Update supply and demand for an item
   */
  updateSupplyDemand(settlementId, itemKey, supplyChange, demandChange) {
    const market = this.markets.get(settlementId);
    if (!market) return;

    let sd = market.supplyDemand.get(itemKey);
    if (!sd) {
      sd = { supply: 100, demand: 100 };
      market.supplyDemand.set(itemKey, sd);
    }

    sd.supply = Math.max(0, sd.supply + supplyChange);
    sd.demand = Math.max(0, sd.demand + demandChange);
  }

  /**
   * Update all markets (called once per game-turn).
   *
   * TRACK 2: `currentTime` is the cumulative game-minute count from
   * kernel.worldTime.totalMinutes (NOT this.kernel?.turn ?? 0). Restock cadence is
   * every 1440 game-minutes = one in-game day.
   */
  update(currentTime) {
    const gameMinutes = typeof currentTime === 'number'
      ? currentTime
      : (this.kernel?.worldTime?.totalMinutes ?? 0);
    const RESTOCK_INTERVAL = 1440; // game-minutes per restock cycle (1 in-game day)

    for (const [id, market] of this.markets) {
      // Restock shops periodically (every in-game day)
      if (gameMinutes - market.lastUpdate > RESTOCK_INTERVAL) {
        for (const shopId of market.shops) {
          const shop = this.shops.get(shopId);
          if (shop) {
            this.restockShop(shop, market);
          }
        }
        market.lastUpdate = gameMinutes;
      }

      // Update supply/demand trends
      for (const [itemKey, sd] of market.supplyDemand) {
        // Gradual return to equilibrium
        sd.supply += (100 - sd.supply) * 0.1;
        sd.demand += (100 - sd.demand) * 0.1;
      }
    }

    // Update traveling merchants (uses game-minute timing internally too)
    this.updateMerchants(gameMinutes);
  }

  /**
   * Restock a shop based on local production and trade
   */
  restockShop(shop, market = null) {
    if (!market) {
      market = this.markets.get(shop.settlementId);
    }

    for (const [key, item] of shop.inventory) {
      let restockAmount = 0;
      
      if (item.locallyProduced) {
        // Local production: restock based on production capacity
        restockAmount = Math.floor(10 * shop.productionCapacity);
      } else {
        // Must import: slower restock, depends on trade routes
        const hasTradeRoutes = market && market.tradeConnections.length > 0;
        restockAmount = hasTradeRoutes ? 3 : 1;
      }
      
      // Don't exceed reasonable stock levels
      const maxStock = item.locallyProduced ? 100 : 30;
      item.quantity = Math.min(maxStock, item.quantity + restockAmount);
    }
  }

  /**
   * Create trade route between two settlements
   */
  createTradeRoute(settlement1Id, settlement2Id) {
    const market1 = this.markets.get(settlement1Id);
    const market2 = this.markets.get(settlement2Id);

    if (!market1 || !market2) {
      return { success: false, reason: 'One or both settlements not found' };
    }

    const routeId = `route_${settlement1Id}_${settlement2Id}`;

    // Calculate distance between settlements
    const distance = Math.sqrt(
      Math.pow(market1.location.x - market2.location.x, 2) +
      Math.pow(market1.location.y - market2.location.y, 2)
    );

    const route = {
      id: routeId,
      settlement1: settlement1Id,
      settlement2: settlement2Id,
      distance: distance,
      travelTime: Math.ceil(distance / 10), // in-game days to travel
      merchants: [],
      goodsFlow: new Map(), // Track what goods flow between settlements
      // TRACK 2: store lastTravel as game-minutes so route timing aligns
      // with kernel.worldTime.totalMinutes.
      lastTravel: this.kernel?.worldTime?.totalMinutes ?? 0
    };

    this.tradeRoutes.set(routeId, route);
    
    // Add route to both markets
    market1.tradeConnections.push(routeId);
    market2.tradeConnections.push(routeId);

    return { success: true, route: route };
  }

  /**
   * Create traveling merchant
   */
  createMerchant(homeSettlementId, name = null) {
    const merchantId = `merchant_${homeSettlementId}_${this.kernel?.turn ?? 0}`;
    
    const merchant = {
      id: merchantId,
      name: name || this.generateMerchantName(),
      homeSettlement: homeSettlementId,
      currentLocation: homeSettlementId,
      inventory: new Map(),
      wealth: 1000,
      reputation: 0.5,
      currentRoute: null,
      travelProgress: 0,
      tradingSkill: 0.5 + this.kernel.rng.next() * 0.5
    };

    this.merchants.set(merchantId, merchant);
    return merchant;
  }

  /**
   * Generate merchant name
   */
  generateMerchantName() {
    const r = this.kernel.rng;
    const firstNames = ['Marcus', 'Giovanni', 'Hans', 'Pierre', 'Willem', 'Rodrigo'];
    const lastNames = ['the Trader', 'the Merchant', 'the Peddler', 'the Dealer'];
    return `${firstNames[r.nextInt(0, firstNames.length - 1)]} ${lastNames[r.nextInt(0, lastNames.length - 1)]}`;
  }

  /**
   * Merchant travels along trade route
   */
  merchantTravel(merchantId, routeId) {
    const merchant = this.merchants.get(merchantId);
    const route = this.tradeRoutes.get(routeId);
    
    if (!merchant || !route) {
      return { success: false, reason: 'Merchant or route not found' };
    }

    // Determine destination
    const destination = merchant.currentLocation === route.settlement1 
      ? route.settlement2 
      : route.settlement1;

    merchant.currentRoute = routeId;
    merchant.travelProgress = 0;
    
    // Load goods to trade
    this.loadMerchantGoods(merchant);

    return {
      success: true,
      destination: destination,
      travelTime: route.travelTime
    };
  }

  /**
   * Load merchant with goods from current location
   */
  loadMerchantGoods(merchant) {
    const market = this.markets.get(merchant.currentLocation);
    if (!market) return;

    // Identify goods that are abundant locally
    const localGoods = [];
    
    for (const shopId of market.shops) {
      const shop = this.shops.get(shopId);
      if (!shop) continue;

      for (const [key, item] of shop.inventory) {
        if (item.locallyProduced && item.quantity > 20) {
          localGoods.push({
            type: item.type,
            subtype: item.subtype,
            buyPrice: item.currentPrice,
            quantity: Math.min(10, Math.floor(item.quantity * 0.2))
          });
        }
      }
    }

    // Merchant buys local goods to sell elsewhere
    for (const good of localGoods) {
      const cost = good.buyPrice * good.quantity;
      if (merchant.wealth >= cost) {
        merchant.wealth -= cost;
        
        const itemKey = `${good.type}_${good.subtype}`;
        const existing = merchant.inventory.get(itemKey);
        
        if (existing) {
          existing.quantity += good.quantity;
        } else {
          merchant.inventory.set(itemKey, {
            type: good.type,
            subtype: good.subtype,
            quantity: good.quantity,
            buyPrice: good.buyPrice
          });
        }
      }
    }
  }

  /**
   * Merchant arrives at destination and sells goods
   */
  merchantArrive(merchantId) {
    const merchant = this.merchants.get(merchantId);
    if (!merchant || !merchant.currentRoute) return;

    const route = this.tradeRoutes.get(merchant.currentRoute);
    if (!route) return;

    // Update location
    merchant.currentLocation = merchant.currentLocation === route.settlement1 
      ? route.settlement2 
      : route.settlement1;

    // Sell goods at destination
    this.merchantSellGoods(merchant);

    // Clear route
    merchant.currentRoute = null;
    merchant.travelProgress = 0;

    return {
      success: true,
      location: merchant.currentLocation,
      profit: merchant.wealth
    };
  }

  /**
   * Merchant sells goods at current location
   */
  merchantSellGoods(merchant) {
    const market = this.markets.get(merchant.currentLocation);
    if (!market) return;

    // Find shops that want merchant's goods
    for (const [itemKey, item] of merchant.inventory) {
      for (const shopId of market.shops) {
        const shop = this.shops.get(shopId);
        if (!shop) continue;

        const shopItem = shop.inventory.get(itemKey);
        
        // Shop wants this item if:
        // 1. It doesn't have it, or
        // 2. It's not locally produced and stock is low
        const wantsItem = !shopItem || 
                         (!shopItem.locallyProduced && shopItem.quantity < 10);

        if (wantsItem && item.quantity > 0) {
          // Calculate sell price (markup based on scarcity)
          const markup = shopItem ? 1.5 : 2.0;
          const sellPrice = Math.floor(item.buyPrice * markup);
          const quantityToSell = Math.min(item.quantity, 5);
          
          const revenue = sellPrice * quantityToSell;
          
          if (shop.wealth >= revenue) {
            // Complete transaction
            merchant.wealth += revenue;
            shop.wealth -= revenue;
            item.quantity -= quantityToSell;
            
            // Add to shop inventory
            if (shopItem) {
              shopItem.quantity += quantityToSell;
            } else {
              shop.inventory.set(itemKey, {
                type: item.type,
                subtype: item.subtype,
                quantity: quantityToSell,
                basePrice: sellPrice,
                currentPrice: sellPrice,
                locallyProduced: false,
                requires: []
              });
            }
            
            // Track goods flow
            route.goodsFlow.set(itemKey, 
              (route.goodsFlow.get(itemKey) || 0) + quantityToSell
            );
          }
        }
      }
    }

    // Clear sold inventory
    for (const [key, item] of merchant.inventory) {
      if (item.quantity === 0) {
        merchant.inventory.delete(key);
      }
    }
  }

  /**
   * Update merchant travel progress.
   *
   * TRACK 2: tick once per in-game day (1440 game-minutes), not on every
   * per-turn call. travelProgress is measured in days now.
   */
  updateMerchants(currentTime) {
    const gameMinutes = typeof currentTime === 'number'
      ? currentTime
      : (this.kernel?.worldTime?.totalMinutes ?? 0);
    const ONE_DAY = 1440;

    for (const [id, merchant] of this.merchants) {
      if (merchant.currentRoute) {
        const route = this.tradeRoutes.get(merchant.currentRoute);
        if (route) {
          // tickMerchantDay: only advance every in-game day
          if (merchant._lastMerchantTick === undefined) merchant._lastMerchantTick = 0;
          if (gameMinutes - merchant._lastMerchantTick < ONE_DAY) continue;
          merchant._lastMerchantTick = gameMinutes;
          merchant.travelProgress = (merchant.travelProgress || 0) + 1;

          // Arrived at destination
          if (merchant.travelProgress >= route.travelTime) {
            this.merchantArrive(id);
          }
        }
      } else {
        // Merchant at settlement, decide if should travel — once per in-game day.
        if (merchant._lastDecisionTick === undefined) merchant._lastDecisionTick = 0;
        if (gameMinutes - merchant._lastDecisionTick < ONE_DAY) continue;
        merchant._lastDecisionTick = gameMinutes;

        const market = this.markets.get(merchant.currentLocation);
        if (market && market.tradeConnections.length > 0) {
          // 10% chance per day to start traveling
          if (this.kernel.rng.next() < 0.1) {
            const routeId = market.tradeConnections[
              this.kernel.rng.nextInt(0, market.tradeConnections.length - 1)
            ];
            this.merchantTravel(id, routeId);
          }
        }
      }
    }
  }

  toJSON() {
    return {
      shops: Array.from(this.shops.entries()).map(([k, v]) => [k, this._serializeShop(v)]),
      merchants: Array.from(this.merchants.entries()),
      markets: Array.from(this.markets.entries()).map(([k, v]) => [k, this._serializeMarket(v)]),
      tradeRoutes: Array.from(this.tradeRoutes.entries()),
      priceHistory: Array.from(this.priceHistory.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.shops) this.shops = new Map(data.shops.map(([k, v]) => [k, this._deserializeShop(v)]));
    if (data.merchants) this.merchants = new Map(data.merchants);
    if (data.markets) this.markets = new Map(data.markets.map(([k, v]) => [k, this._deserializeMarket(v)]));
    if (data.tradeRoutes) this.tradeRoutes = new Map(data.tradeRoutes);
    if (data.priceHistory) this.priceHistory = new Map(data.priceHistory);
  }

  _serializeShop(shop) {
    return {
      ...shop,
      inventory: shop.inventory instanceof Map ? Array.from(shop.inventory.entries()) : shop.inventory,
      supplyChains: shop.supplyChains || []
    };
  }

  _deserializeShop(shop) {
    return {
      ...shop,
      inventory: shop.inventory ? new Map(shop.inventory) : new Map(),
      supplyChains: shop.supplyChains || []
    };
  }

  _serializeMarket(market) {
    return {
      ...market,
      priceIndex: market.priceIndex instanceof Map ? Array.from(market.priceIndex.entries()) : market.priceIndex,
      supplyDemand: market.supplyDemand instanceof Map ? Array.from(market.supplyDemand.entries()) : market.supplyDemand
    };
  }

  _deserializeMarket(market) {
    return {
      ...market,
      priceIndex: market.priceIndex ? new Map(market.priceIndex) : new Map(),
      supplyDemand: market.supplyDemand ? new Map(market.supplyDemand) : new Map()
    };
  }
}
