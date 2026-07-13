/**
 * Settlements.js
 * Land parcels, traffic flow, maintenance coordination
 * Models urban planning, property, congestion, upkeep
 */

export class Settlements {
  constructor(buildingSystem, infrastructureSystem) {
    this.buildingSystem = buildingSystem;
    this.infrastructureSystem = infrastructureSystem;
    this.settlements = new Map();
    this.parcels = new Map();
    this.nextSettlementId = 1;
    this.nextParcelId = 1;
  }

  found(location, name, type) {
    const settlement = {
      id: this.nextSettlementId++,
      name: name,
      type: type, // village, town, city
      location: location,
      founded: this.kernel?.turn ?? 0,
      population: 0,
      parcels: [],
      buildings: [],
      infrastructure: {
        roads: [],
        bridges: [],
        wells: [],
        drainage: []
      },
      economy: {
        wealth: 0,
        trade: 0,
        taxes: 0
      },
      governance: {
        laws: [],
        officials: []
      },
      maintenance: {
        budget: 0,
        schedule: []
      }
    };
    
    // Create initial parcels
    this.subdivideLand(settlement.id, location, this.getInitialSize(type));
    
    this.settlements.set(settlement.id, settlement);
    
    return {
      success: true,
      settlement: settlement
    };
  }

  getInitialSize(type) {
    const sizes = {
      village: 100, // 100m x 100m
      town: 500,
      city: 2000
    };
    return sizes[type] || 100;
  }

  subdivideLand(settlementId, center, size) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return;
    
    // Create grid of parcels
    const parcelSize = 20; // 20m x 20m
    const parcelsPerSide = Math.floor(size / parcelSize);
    
    for (let x = 0; x < parcelsPerSide; x++) {
      for (let y = 0; y < parcelsPerSide; y++) {
        const parcel = this.createParcel(
          settlementId,
          {
            x: center.x - size/2 + x * parcelSize,
            y: center.y - size/2 + y * parcelSize,
            z: center.z
          },
          parcelSize
        );
        settlement.parcels.push(parcel.id);
      }
    }
  }

  createParcel(settlementId, location, size) {
    const parcel = {
      id: this.nextParcelId++,
      settlement: settlementId,
      location: location,
      size: size,
      type: 'vacant', // vacant, residential, commercial, industrial, public
      owner: null,
      building: null,
      value: this.calculateParcelValue(location, size),
      zoning: 'mixed',
      access: {
        road: false,
        water: false,
        drainage: false
      }
    };
    
    this.parcels.set(parcel.id, parcel);
    return parcel;
  }

  calculateParcelValue(location, size) {
    // Simplified valuation
    let value = size * 10; // Base value
    
    // Location affects value (center is more valuable)
    const distanceFromCenter = Math.sqrt(location.x * location.x + location.y * location.y);
    value *= Math.max(0.5, 1 - distanceFromCenter / 1000);
    
    return value;
  }

  allocateParcel(parcelId, owner, purpose) {
    const parcel = this.parcels.get(parcelId);
    if (!parcel) {
      return { success: false, reason: 'Unknown parcel' };
    }
    
    if (parcel.owner) {
      return { success: false, reason: 'Parcel already owned' };
    }
    
    // Check zoning
    if (!this.checkZoning(parcel, purpose)) {
      return { success: false, reason: 'Zoning violation' };
    }
    
    parcel.owner = owner;
    parcel.type = purpose;
    
    return {
      success: true,
      parcel: parcel,
      cost: parcel.value
    };
  }

  checkZoning(parcel, purpose) {
    if (parcel.zoning === 'mixed') return true;
    
    const allowedUses = {
      residential: ['residential', 'public'],
      commercial: ['commercial', 'public'],
      industrial: ['industrial'],
      agricultural: ['agricultural']
    };
    
    return allowedUses[parcel.zoning]?.includes(purpose) || false;
  }

  buildOnParcel(parcelId, buildingDesign, materials, builders) {
    const parcel = this.parcels.get(parcelId);
    if (!parcel) {
      return { success: false, reason: 'Unknown parcel' };
    }
    
    if (parcel.building) {
      return { success: false, reason: 'Parcel already has building' };
    }
    
    // Check access
    if (!parcel.access.road) {
      return { success: false, reason: 'No road access' };
    }
    
    // Build
    const result = this.buildingSystem.construct(
      parcel.location,
      buildingDesign,
      materials,
      builders
    );
    
    if (!result.success) {
      return result;
    }
    
    parcel.building = result.building.id;
    
    const settlement = this.settlements.get(parcel.settlement);
    if (settlement) {
      settlement.buildings.push(result.building.id);
    }
    
    return result;
  }

  connectRoad(settlementId, parcelIds) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      return { success: false, reason: 'Unknown settlement' };
    }
    
    const roads = [];
    
    for (let i = 0; i < parcelIds.length - 1; i++) {
      const parcel1 = this.parcels.get(parcelIds[i]);
      const parcel2 = this.parcels.get(parcelIds[i + 1]);
      
      if (!parcel1 || !parcel2) continue;
      
      // Build road segment
      const road = this.infrastructureSystem.buildRoad(
        parcel1.location,
        parcel2.location,
        'cobblestone',
        5
      );
      
      if (road.success) {
        roads.push(road.road.id);
        settlement.infrastructure.roads.push(road.road.id);
        
        // Mark parcels as having road access
        parcel1.access.road = true;
        parcel2.access.road = true;
      }
    }
    
    return {
      success: true,
      roads: roads
    };
  }

  provideWater(settlementId, parcelIds, wellLocation) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      return { success: false, reason: 'Unknown settlement' };
    }
    
    // Dig well
    const well = this.infrastructureSystem.digWell(wellLocation, 20, 'stone');
    
    if (!well.success) {
      return well;
    }
    
    settlement.infrastructure.wells.push(well.well.id);
    
    // Mark nearby parcels as having water access
    for (const parcelId of parcelIds) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;
      
      const distance = Math.sqrt(
        Math.pow(parcel.location.x - wellLocation.x, 2) +
        Math.pow(parcel.location.y - wellLocation.y, 2)
      );
      
      if (distance < 100) {
        parcel.access.water = true;
      }
    }
    
    return {
      success: true,
      well: well.well,
      parcelsServed: parcelIds.length
    };
  }

  installDrainage(settlementId, area) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      return { success: false, reason: 'Unknown settlement' };
    }
    
    // Build drainage system
    const drainage = this.infrastructureSystem.buildDrainage(area, 'ditch', 1000);
    
    if (!drainage.success) {
      return drainage;
    }
    
    settlement.infrastructure.drainage.push(drainage.drainage.id);
    
    // Mark parcels in area as having drainage
    for (const parcelId of settlement.parcels) {
      const parcel = this.parcels.get(parcelId);
      if (!parcel) continue;
      
      // Check if parcel is in drainage area
      if (this.isInArea(parcel.location, area)) {
        parcel.access.drainage = true;
      }
    }
    
    return {
      success: true,
      drainage: drainage.drainage
    };
  }

  isInArea(location, area) {
    return location.x >= area.x1 && location.x <= area.x2 &&
           location.y >= area.y1 && location.y <= area.y2;
  }

  simulateTraffic(settlementId, timeStep) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return;
    
    // Calculate traffic based on population and time of day
    const baseTraffic = settlement.population * 0.1;
    const hourOfTurn = (this.kernel?.turn ?? 0) % 24;
    
    // Peak hours: 8-9am, 5-6pm
    let trafficMultiplier = 1.0;
    if ((hourOfTurn >= 8 && hourOfTurn <= 9) || (hourOfTurn >= 17 && hourOfTurn <= 18)) {
      trafficMultiplier = 2.0;
    }
    
    const traffic = baseTraffic * trafficMultiplier;
    
    // Apply traffic to roads
    for (const roadId of settlement.infrastructure.roads) {
      this.infrastructureSystem.useRoad(roadId, traffic * timeStep, 'clear');
    }
    
    return {
      traffic: traffic,
      congestion: this.calculateCongestion(settlement, traffic)
    };
  }

  calculateCongestion(settlement, traffic) {
    const roadCapacity = settlement.infrastructure.roads.length * 100; // Simplified
    return Math.min(1, traffic / roadCapacity);
  }

  scheduleMaintenance(settlementId, budget) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      return { success: false, reason: 'Unknown settlement' };
    }
    
    settlement.maintenance.budget = budget;
    
    // Prioritize maintenance
    const tasks = [];
    
    // Check roads
    for (const roadId of settlement.infrastructure.roads) {
      const road = this.infrastructureSystem.getRoad(roadId);
      if (road && road.condition < 0.7) {
        tasks.push({
          type: 'road',
          id: roadId,
          priority: 1 - road.condition,
          cost: this.infrastructureSystem.calculateRoadCost(road) * (1 - road.condition)
        });
      }
    }
    
    // Check bridges
    for (const bridgeId of settlement.infrastructure.bridges) {
      const bridge = this.infrastructureSystem.getBridge(bridgeId);
      if (bridge && bridge.condition < 0.7) {
        tasks.push({
          type: 'bridge',
          id: bridgeId,
          priority: (1 - bridge.condition) * 1.5, // Bridges are more critical
          cost: this.infrastructureSystem.calculateBridgeCost(bridge) * (1 - bridge.condition)
        });
      }
    }
    
    // Check wells
    for (const wellId of settlement.infrastructure.wells) {
      const well = this.infrastructureSystem.getWell(wellId);
      if (well && well.contamination > 0.3) {
        tasks.push({
          type: 'well',
          id: wellId,
          priority: well.contamination * 1.2,
          cost: 50
        });
      }
    }
    
    // Check drainage
    for (const drainageId of settlement.infrastructure.drainage) {
      const drainage = this.infrastructureSystem.getDrainage(drainageId);
      if (drainage && drainage.clogged > 0.5) {
        tasks.push({
          type: 'drainage',
          id: drainageId,
          priority: drainage.clogged,
          cost: 30
        });
      }
    }
    
    // Sort by priority
    tasks.sort((a, b) => b.priority - a.priority);
    
    // Schedule within budget
    const schedule = [];
    let remainingBudget = budget;
    
    for (const task of tasks) {
      if (task.cost <= remainingBudget) {
        schedule.push(task);
        remainingBudget -= task.cost;
      }
    }
    
    settlement.maintenance.schedule = schedule;
    
    return {
      success: true,
      schedule: schedule,
      totalCost: budget - remainingBudget,
      remainingBudget: remainingBudget
    };
  }

  performMaintenance(settlementId, workers) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) {
      return { success: false, reason: 'Unknown settlement' };
    }
    
    const results = [];
    
    for (const task of settlement.maintenance.schedule) {
      let result;
      
      switch (task.type) {
        case 'road':
          result = this.infrastructureSystem.repairRoad(task.id, {}, workers);
          break;
        case 'bridge':
          result = this.infrastructureSystem.repairBridge(task.id, {}, workers);
          break;
        case 'well':
          result = this.infrastructureSystem.cleanWell(task.id, workers);
          break;
        case 'drainage':
          result = this.infrastructureSystem.clearDrainage(task.id, workers);
          break;
      }
      
      if (result) {
        results.push({
          task: task,
          result: result
        });
      }
    }
    
    // Clear schedule
    settlement.maintenance.schedule = [];
    
    return {
      success: true,
      completed: results.length,
      results: results
    };
  }

  updatePopulation(settlementId, change) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return;
    
    settlement.population = Math.max(0, settlement.population + change);
  }

  getSettlement(id) {
    return this.settlements.get(id);
  }

  getParcel(id) {
    return this.parcels.get(id);
  }

  getVacantParcels(settlementId) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return [];
    
    return settlement.parcels
      .map(id => this.parcels.get(id))
      .filter(p => p && p.type === 'vacant');
  }

  getParcelsWithAccess(settlementId, accessType) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return [];
    
    return settlement.parcels
      .map(id => this.parcels.get(id))
      .filter(p => p && p.access[accessType]);
  }

  getSettlementStats(settlementId) {
    const settlement = this.settlements.get(settlementId);
    if (!settlement) return null;

    const totalParcels = settlement.parcels.length;
    const occupiedParcels = settlement.parcels
      .map(id => this.parcels.get(id))
      .filter(p => p && p.type !== 'vacant')
      .length;

    const roadCondition = settlement.infrastructure.roads
      .map(id => this.infrastructureSystem.getRoad(id))
      .filter(r => r)
      .reduce((sum, r) => sum + r.condition, 0) / settlement.infrastructure.roads.length || 0;

    return {
      population: settlement.population,
      parcels: {
        total: totalParcels,
        occupied: occupiedParcels,
        vacant: totalParcels - occupiedParcels
      },
      infrastructure: {
        roads: settlement.infrastructure.roads.length,
        roadCondition: roadCondition,
        wells: settlement.infrastructure.wells.length,
        drainage: settlement.infrastructure.drainage.length
      },
      economy: settlement.economy
    };
  }

  toJSON() {
    return {
      settlements: Array.from(this.settlements.entries()),
      parcels: Array.from(this.parcels.entries()),
      nextSettlementId: this.nextSettlementId,
      nextParcelId: this.nextParcelId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.settlements) this.settlements = new Map(data.settlements);
    if (data.parcels) this.parcels = new Map(data.parcels);
    if (typeof data.nextSettlementId === 'number') this.nextSettlementId = data.nextSettlementId;
    if (typeof data.nextParcelId === 'number') this.nextParcelId = data.nextParcelId;
  }
}
